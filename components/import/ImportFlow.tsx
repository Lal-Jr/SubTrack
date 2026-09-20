'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { detectSubscriptions, toInterval, type DetectedSubscription } from '@/lib/detection';
import { dedupeKeys, extractCsv, loadStatement, type CsvOptions, type LoadedStatement, type ParseResult } from '@/lib/import';
import { loadExisting, saveImport, type ExistingData } from '@/lib/import/store';
import { formatMoney, toMajor } from '@/types/money';
import MappingStep from './MappingStep';

type Step = 'upload' | 'mapping' | 'review';

const CATEGORIES = ['Entertainment', 'Software', 'Utilities', 'Finance', 'Shopping', 'Food & Drink', 'Other'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export default function ImportFlow({ onSuccess }: { onSuccess?: () => void }) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<Step>('upload');
    const [busy, setBusy] = useState(false);
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

    const isSelected = (d: DetectedSubscription) => selected[d.key] ?? d.active;

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
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

    return (
        <div className="flex flex-col h-full w-full space-y-4">
            {error && <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">{error}</p>}

            {step === 'upload' && (
                <div className="space-y-4">
                    <p className="text-sm text-zinc-400">
                        Choose a bank statement (CSV or PDF). It is read on this device and never uploaded.
                        Importing several statements over time improves detection, and overlapping statements will not create duplicates.
                    </p>
                    <label className="block max-w-[180px]">
                        <span className="label block mb-1">Statement currency</span>
                        <select className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </label>
                    <div className="border border-dashed border-white/10 rounded-xl p-8 text-center bg-white/[0.01]">
                        <input type="file" accept=".csv,.pdf" className="hidden" ref={fileRef} onChange={handleFile} />
                        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                            {busy ? 'Reading…' : 'Select CSV or PDF file'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'mapping' && statement?.kind === 'csv' && csvOptions && (
                <>
                    <MappingStep grid={statement.grid} options={csvOptions} currency={currency} dateOrderAmbiguous={dateOrderAmbiguous} onChange={setCsvOptions} />
                    <div className="flex justify-between">
                        <button type="button" className="text-sm text-zinc-400 hover:text-white" onClick={reset}>Cancel</button>
                        <button type="button" className="btn" disabled={!parsed || parsed.transactions.length === 0} onClick={() => setStep('review')}>
                            Continue
                        </button>
                    </div>
                </>
            )}

            {step === 'review' && analysis && parsed && (
                <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-lg space-y-1">
                        <p className="font-medium text-emerald-400 truncate" title={fileName}>{fileName}</p>
                        <p className="text-sm text-zinc-300">
                            {parsed.transactions.length} transactions ({analysis.range}): {analysis.debits} debits, {parsed.transactions.length - analysis.debits} credits.
                        </p>
                        <p className="text-xs text-zinc-400">
                            {analysis.fresh.length} new, {analysis.duplicates} already imported.
                            {analysis.alreadyTracked > 0 && ` ${analysis.alreadyTracked} recurring payment(s) are already in your subscriptions.`}
                        </p>
                        <div className="flex gap-4 pt-1">
                            {statement?.kind === 'csv' && (
                                <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300" onClick={() => setStep('mapping')}>Adjust columns</button>
                            )}
                            <button type="button" className="text-xs text-zinc-400 hover:text-white" onClick={reset}>Choose another file</button>
                        </div>
                    </div>

                    {parsed.warnings.map((w) => (
                        <p key={w} className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">{w}</p>
                    ))}

                    {analysis.candidates.length === 0 ? (
                        <p className="text-center p-6 text-zinc-400 text-sm">
                            No new recurring payments found. Transactions can still be saved, and detection improves as you import more months.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                            {analysis.candidates.map((d) => (
                                <label
                                    key={d.key}
                                    className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer border ${isSelected(d) ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent opacity-60'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected(d)}
                                        onChange={() => setSelected((s) => ({ ...s, [d.key]: !isSelected(d) }))}
                                        className="w-5 h-5"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate" title={d.merchant}>{d.merchant}</p>
                                        <p className="text-xs text-zinc-400">
                                            {d.frequency}, {d.occurrences === 1 ? 'seen once' : `${d.occurrences} charges`}
                                            {d.priceChanged && ', price changed'}
                                            {' · '}
                                            {d.active ? `next ${d.nextDate}` : `looks cancelled (last ${d.lastDate})`}
                                        </p>
                                        <select
                                            value={categories[d.key] ?? d.category ?? ''}
                                            onChange={(e) => setCategories((c) => ({ ...c, [d.key]: e.target.value }))}
                                            onClick={(e) => e.preventDefault()}
                                            aria-label={`Category for ${d.merchant}`}
                                            className="mt-2 text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 rounded p-1 max-w-[150px]"
                                        >
                                            <option value="">No category</option>
                                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="font-semibold text-right flex-none">{formatMoney(d.amountMinor, currency)}</div>
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="pt-2 flex justify-end">
                        <button
                            type="button"
                            className="btn"
                            onClick={handleImport}
                            disabled={busy || (analysis.fresh.length === 0 && !analysis.candidates.some(isSelected))}
                        >
                            {busy ? 'Saving…' : `Save ${analysis.fresh.length} transactions and ${analysis.candidates.filter(isSelected).length} subscriptions`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const selectCls = 'w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1.5 text-sm';
