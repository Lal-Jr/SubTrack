'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { CATEGORIES } from '@/lib/chartColors';
import { CURRENCIES } from '@/lib/currencies';
import { detectSubscriptions, toInterval, type DetectedSubscription } from '@/lib/detection';
import { formatMajor, formatShortDate } from '@/lib/format';
import { dedupeKeys, extractCsv, loadStatement, type CsvOptions, type LoadedStatement, type ParseResult } from '@/lib/import';
import { loadExisting, saveImport, type ExistingData } from '@/lib/import/store';
import { toMajor } from '@/types/money';
import MappingStep from './MappingStep';

type Step = 'upload' | 'mapping' | 'review';

const STEPS: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Choose' },
    { key: 'mapping', label: 'Check' },
    { key: 'review', label: 'Review' },
];

function Stepper({ step, showCheck }: { step: Step; showCheck: boolean }) {
    const visible = STEPS.filter((s) => showCheck || s.key !== 'mapping');
    const at = visible.findIndex((s) => s.key === step);
    return (
        <ol className="flex items-center gap-3 mb-8" aria-label="Import progress">
            {visible.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3" aria-current={i === at ? 'step' : undefined}>
                    <span className={`eyebrow flex items-center gap-2 ${i === at ? '!text-accent' : i < at ? '!text-ink-2' : ''}`}>
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${i === at ? 'border-accent' : i < at ? 'bg-ink text-canvas border-ink' : 'border-line-strong'}`}>{i < at ? '✓' : i + 1}</span>
                        {s.label}
                    </span>
                    {i < visible.length - 1 && <span className="w-8 h-px bg-line-strong" aria-hidden />}
                </li>
            ))}
        </ol>
    );
}

export default function ImportFlow({ onSuccess }: { onSuccess?: () => void }) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>('upload');
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [statement, setStatement] = useState<LoadedStatement | null>(null);
    const [csvOptions, setCsvOptions] = useState<CsvOptions | null>(null);
    const [dateOrderAmbiguous, setAmbiguous] = useState(false);
    const [currency, setCurrency] = useState('INR');
    const [existing, setExisting] = useState<ExistingData | null>(null);
    // Per-merchant user choices, keyed by merchant key so they survive re-parsing.
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [categories, setCategories] = useState<Record<string, string>>({});

    const parsed: ParseResult | null = useMemo(() => {
        if (!statement) return null;
        if (statement.kind === 'pdf') return statement.result;
        return csvOptions ? extractCsv(statement.grid, csvOptions) : null;
    }, [statement, csvOptions]);

    // Split into new rows and rows already stored, then detect over everything so history accumulates.
    const analysis = useMemo(() => {
        if (!parsed || !existing) return null;
        const keys = dedupeKeys(parsed.transactions);
        const fresh = parsed.transactions
            .map((t, i) => ({ t, key: keys[i] }))
            .filter(({ key }) => !existing.keys.has(key));
        const all = [...existing.transactions, ...fresh.map((f) => f.t)];
        const detected = detectSubscriptions(all);
        const candidates = detected.filter((d) => !existing.trackedMerchants.has(d.key));
        const dates = parsed.transactions.map((t) => t.date).sort();
        return {
            fresh,
            duplicates: parsed.transactions.length - fresh.length,
            candidates,
            alreadyTracked: detected.length - candidates.length,
            range: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : '',
            debits: parsed.transactions.filter((t) => t.amountMinor < 0).length,
        };
    }, [parsed, existing]);

    // Lapsed and seen-once candidates are offered but not pre-selected.
    const isSelected = (d: DetectedSubscription) => selected[d.key] ?? (d.active && d.status !== 'possible');

    const processFile = async (file: File) => {
        setBusy(true);
        setError(null);
        try {
            const [loaded, data] = await Promise.all([loadStatement(file), loadExisting()]);
            setFileName(file.name);
            setExisting(data);
            setStatement(loaded);
            setSelected({});
            setCategories({});
            if (loaded.kind === 'csv') {
                const d = loaded.detection;
                setAmbiguous(d.dateOrderAmbiguous);
                setCsvOptions({
                    headerRow: d.headerRow,
                    mapping: d.mapping ?? { date: 0, description: 1, amount: 2 },
                    dateOrder: d.dateOrder,
                    positiveIsDebit: false,
                });
                // Only interrupt the user when detection was unsure.
                setStep(d.mapping && !d.dateOrderAmbiguous ? 'review' : 'mapping');
            } else {
                setStep('review');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not read this file.');
        } finally {
            setBusy(false);
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void processFile(file);
    };

    const handleImport = async () => {
        if (!analysis) return;
        setBusy(true);
        setError(null);
        try {
            await saveImport({
                transactions: analysis.fresh,
                currency,
                subscriptions: analysis.candidates.filter(isSelected).map((d) => {
                    const interval = toInterval(d.frequency);
                    return {
                        name: d.merchant,
                        amount: toMajor(d.amountMinor),
                        currency,
                        intervalCount: interval.count,
                        intervalUnit: interval.unit,
                        lastChargeDate: d.lastDate,
                        nextChargeDate: d.nextDate,
                        confidence: d.confidence,
                        isVariable: d.isVariable,
                        active: d.active,
                        category: categories[d.key] ?? d.category,
                    };
                }),
            });
            onSuccess?.();
            router.push('/');
            router.refresh();
        } catch (err) {
            console.error('Import failed', err);
            setError('Saving failed. Nothing was imported.');
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setStep('upload');
        setStatement(null);
        setError(null);
    };

    const chosen = analysis?.candidates.filter(isSelected).length ?? 0;

    return (
        <div>
            <Stepper step={step} showCheck={statement?.kind === 'csv' || step === 'mapping'} />

            {error && <p role="alert" className="mb-6 text-sm text-danger border border-danger/40 rounded-xl p-3">{error}</p>}

            {step === 'upload' && (
                <div className="space-y-6">
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`rounded-3xl border border-dashed px-6 py-14 sm:py-20 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}
                    >
                        <input type="file" accept=".csv,.pdf" className="hidden" ref={fileRef} onChange={handleInput} />
                        <p className="font-display text-4xl sm:text-5xl leading-none">{dragging ? 'Let go.' : 'Drop a statement here.'}</p>
                        <p className="text-sm text-ink-3 mt-4">Bank CSV or PDF. It is read on this device and never uploaded.</p>
                        <Button variant="primary" className="mt-7" onClick={() => fileRef.current?.click()} disabled={busy}>
                            {busy ? 'Reading…' : 'Choose a file'}
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-3">
                        <p className="max-w-sm">Import several months for better detection. Overlapping statements never create duplicates.</p>
                        <label className="flex items-center gap-3">
                            <span className="eyebrow">Currency</span>
                            <div className="w-28"><Select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
                        </label>
                    </div>
                </div>
            )}

            {step === 'mapping' && statement?.kind === 'csv' && csvOptions && (
                <>
                    <MappingStep grid={statement.grid} options={csvOptions} currency={currency} dateOrderAmbiguous={dateOrderAmbiguous} onChange={setCsvOptions} />
                    <div className="flex justify-between mt-8">
                        <Button variant="ghost" onClick={reset}>Cancel</Button>
                        <Button variant="primary" disabled={!parsed || parsed.transactions.length === 0} onClick={() => setStep('review')}>Continue</Button>
                    </div>
                </>
            )}

            {step === 'review' && analysis && parsed && (
                <div className="space-y-8">
                    <div>
                        <h2 className="font-display text-4xl sm:text-5xl leading-[1.02]">
                            <span className="text-accent">{analysis.candidates.length}</span> recurring{' '}
                            <span className="text-ink-2 italic">in {parsed.transactions.length} transactions.</span>
                        </h2>
                        <p className="text-sm text-ink-3 mt-3">
                            <span className="truncate" title={fileName}>{fileName}</span> · {analysis.range} · {analysis.debits} debits, {parsed.transactions.length - analysis.debits} credits
                        </p>
                        <p className="text-sm text-ink-3">
                            {analysis.fresh.length} new, {analysis.duplicates} already imported.
                            {analysis.alreadyTracked > 0 && ` ${analysis.alreadyTracked} already in your list.`}
                        </p>
                        <div className="flex gap-2 mt-3">
                            {statement?.kind === 'csv' && <Button size="sm" onClick={() => setStep('mapping')}>Adjust columns</Button>}
                            <Button size="sm" variant="ghost" onClick={reset}>Choose another file</Button>
                        </div>
                    </div>

                    {parsed.warnings.map((w) => (
                        <p key={w} className="text-sm text-warn border border-warn/40 rounded-xl p-3">{w}</p>
                    ))}

                    {analysis.candidates.length === 0 ? (
                        <p className="text-sm text-ink-3">
                            No new recurring payments found. Transactions can still be saved, and detection improves as you import more months.
                        </p>
                    ) : (
                        <ul className="border-t border-line">
                            {analysis.candidates.map((d) => {
                                const on = isSelected(d);
                                return (
                                    <li key={d.key} className="flex items-start gap-4 py-4 border-b border-line">
                                        <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={on}
                                            aria-label={`Import ${d.merchant}`}
                                            onClick={() => setSelected((s) => ({ ...s, [d.key]: !on }))}
                                            className={`mt-1 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 text-xs transition-colors ${on ? 'bg-accent border-accent text-accent-ink' : 'border-line-strong text-transparent hover:border-ink-2'}`}
                                        >
                                            ✓
                                        </button>
                                        <div className={`min-w-0 flex-1 ${on ? '' : 'opacity-60'}`}>
                                            <div className="flex items-baseline gap-3">
                                                <span className="truncate text-[17px]">{d.merchant}</span>
                                                <span className="leader" aria-hidden />
                                                <span className="tabular shrink-0">{formatMajor(toMajor(d.amountMinor), currency)}</span>
                                            </div>
                                            <p className="text-xs text-ink-3 mt-1">
                                                {d.frequency} · {d.occurrences === 1 ? 'seen once' : `${d.occurrences} charges`}
                                                {d.priceChanged && ' · price changed'}
                                                {' · '}
                                                {!d.active ? `looks cancelled (last ${formatShortDate(d.lastDate)})` : d.nextDate ? `next ${formatShortDate(d.nextDate)}` : `last charged ${formatShortDate(d.lastDate)}, timing unknown`}
                                            </p>
                                            <div className="w-40 mt-2">
                                                <Select
                                                    value={categories[d.key] ?? d.category ?? ''}
                                                    onChange={(e) => setCategories((c) => ({ ...c, [d.key]: e.target.value }))}
                                                    aria-label={`Category for ${d.merchant}`}
                                                    className="!h-8 !text-xs"
                                                >
                                                    <option value="">No category</option>
                                                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                                </Select>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <div className="sticky bottom-28 md:bottom-6 flex justify-end">
                        <Button
                            variant="primary"
                            className="shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                            onClick={handleImport}
                            disabled={busy || (analysis.fresh.length === 0 && chosen === 0)}
                        >
                            {busy ? 'Saving…' : `Save ${analysis.fresh.length} transactions${chosen ? ` + ${chosen} subscription${chosen === 1 ? '' : 's'}` : ''}`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
