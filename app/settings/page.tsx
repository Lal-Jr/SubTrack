'use client';

import { useRef, useState, type ReactNode } from 'react';
import { KpiStrip } from '@/components/home/parts';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Segmented, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { clearAllData, downloadBackup, importBackup, type ImportMode } from '@/lib/db/backup';
import { clearSampleData, loadSampleData, SAMPLE_SUBSCRIPTIONS } from '@/lib/db/sample';
import { CURRENCIES } from '@/lib/currencies';
import { formatDate } from '@/lib/format';
import { useProfile, type Profile } from '@/lib/hooks/useData';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { saveProfile } from '@/lib/profile';
import { todayUtc } from '@/lib/subscriptions/schedule';

/** A settings block: what it is on the left, the controls on the right. */
function Block({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
    return (
        <section aria-labelledby={id} className="grid md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-x-12 gap-y-4 py-8 border-t border-line">
            <div>
                <h2 id={id} className="font-display text-2xl leading-none">{title}</h2>
                <p className="text-sm text-ink-3 mt-2 max-w-[28ch]">{description}</p>
            </div>
            <div className="max-w-xl">{children}</div>
        </section>
    );
}

function Status({ tone, children }: { tone: 'ok' | 'error'; children: ReactNode }) {
    return (
        <p role="status" className={`text-sm rounded-xl px-3 py-2.5 border ${tone === 'ok' ? 'text-accent border-accent/40 bg-accent-soft' : 'text-danger border-danger/40'}`}>{children}</p>
    );
}

function ProfileBlock() {
    const { profile, loading } = useProfile();
    return (
        <Block id="profile" title="Profile" description="Your name, main currency and income. Used for the greeting, totals and the income share.">
            {loading ? (
                <div className="space-y-4"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            ) : (
                // Keyed on the row so the form starts from stored values once they load.
                <ProfileForm key={profile?.id ?? 'new'} initial={profile} />
            )}
        </Block>
    );
}

function ProfileForm({ initial }: { initial: Profile | null }) {
    const start = { name: initial?.name ?? '', income: initial?.monthly_income != null ? String(initial.monthly_income) : '', currency: initial?.currency ?? 'INR' };
    const [name, setName] = useState(start.name);
    const [income, setIncome] = useState(start.income);
    const [currency, setCurrency] = useState(start.currency);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const dirty = name !== start.name || income !== start.income || currency !== start.currency;
    const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setStatus('idle'); };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('saving');
        try {
            const n = Number(income);
            await saveProfile({ name: name.trim(), monthlyIncome: income.trim() && Number.isFinite(n) && n >= 0 ? n : null, currency });
            setStatus('saved');
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <Field label="Name"><Input value={name} onChange={(e) => touch(setName)(e.target.value)} autoComplete="given-name" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Monthly income" hint="Optional. Never leaves this device.">
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={income} onChange={(e) => touch(setIncome)(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Main currency" hint="Totals use this. Other currencies are not converted.">
                    <Select value={currency} onChange={(e) => touch(setCurrency)(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
                </Field>
            </div>
            <div className="flex items-center gap-3 pt-1">
                <Button type="submit" variant="primary" disabled={!dirty || status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save changes'}</Button>
                <span role="status" className="text-sm">
                    {status === 'saved' && <span className="text-accent">Saved</span>}
                    {status === 'error' && <span className="text-danger">Could not save</span>}
                </span>
            </div>
        </form>
    );
}

function SampleBlock() {
    const q = useLiveQuery<{ c: number }>("SELECT COUNT(*) AS c FROM subscriptions WHERE source = 'sample'");
    const count = q.data[0]?.c ?? 0;
    return (
        <Block id="sample" title="Sample data" description="Try the app without your own data. Sample rows are tagged and removed on their own.">
            <ul className="text-sm text-ink-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 mb-4">
                {SAMPLE_SUBSCRIPTIONS.map((s) => (
                    <li key={s.name} className="flex justify-between gap-4 border-b border-line py-1.5">
                        <span>{s.name}</span>
                        <span className="tabular text-ink-3">₹{s.amount.toLocaleString('en-IN')}/{s.intervalUnit === 'year' ? 'yr' : 'mo'}</span>
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => loadSampleData(todayUtc())} disabled={count > 0}>Load sample data</Button>
                <Button variant="ghost" onClick={() => clearSampleData()} disabled={count === 0}>Remove sample data</Button>
                <span className="text-xs text-ink-3">{count > 0 ? `${count} sample subscriptions loaded` : 'None loaded'}</span>
            </div>
        </Block>
    );
}

function BackupBlock() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<ImportMode>('merge');
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const restore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const counts = await importBackup(await file.text(), mode);
            setMessage({ tone: 'ok', text: `Restored ${counts.subscriptions} subscriptions and ${counts.transactions} transactions.` });
        } catch (err) {
            setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Restore failed.' });
        }
    };

    return (
        <Block id="backup" title="Backup" description="Everything lives on this device. A backup file is how you move it or keep a copy.">
            <div className="space-y-6">
                <div>
                    <p className="text-sm font-medium mb-1">Download</p>
                    <p className="text-xs text-ink-3 mb-3">A JSON file with your subscriptions, transactions and profile.</p>
                    <Button onClick={() => downloadBackup().catch(() => setMessage({ tone: 'error', text: 'Could not create the backup.' }))}>Download backup</Button>
                </div>
                <div className="pt-6 border-t border-line">
                    <p className="text-sm font-medium mb-1">Restore</p>
                    <p className="text-xs text-ink-3 mb-3">Merge adds and updates rows by id. Replace clears everything first.</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Segmented label="Restore mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace' }]} />
                        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
                        <Button onClick={() => fileRef.current?.click()}>Choose backup file</Button>
                    </div>
                </div>
                {message && <Status tone={message.tone}>{message.text}</Status>}
            </div>
        </Block>
    );
}

function DangerBlock() {
    const [confirm, setConfirm] = useState(false);
    const [done, setDone] = useState(false);
    return (
        <Block id="danger" title="Delete everything" description="Remove all data from this device. This cannot be undone.">
            <p className="text-sm text-ink-2 mb-4">Deletes every subscription, transaction and your profile. Download a backup first if you might want it back.</p>
            <div className="flex items-center gap-3">
                <Button variant="danger" onClick={() => { setDone(false); setConfirm(true); }}>Delete all data</Button>
                {done && <span role="status" className="text-sm text-ink-3">All data deleted.</span>}
            </div>
            <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete all data?" width="max-w-sm">
                <p className="text-sm text-ink-2">This permanently removes everything stored by Subtrack on this device.</p>
                <div className="flex justify-end gap-2 mt-5">
                    <Button variant="ghost" onClick={() => setConfirm(false)}>Keep my data</Button>
                    <Button variant="danger" onClick={async () => { await clearAllData(); setConfirm(false); setDone(true); }}>Delete everything</Button>
                </div>
            </Dialog>
        </Block>
    );
}

export default function SettingsPage() {
    const counts = useLiveQuery<{ s: number; t: number }>('SELECT (SELECT COUNT(*) FROM subscriptions) AS s, (SELECT COUNT(*) FROM transactions) AS t');
    const { profile } = useProfile();
    const c = counts.data[0];

    return (
        <div>
            <PageHeader title="Settings" description="Your profile and your data. Nothing here leaves this device." />
            <KpiStrip
                items={[
                    { label: 'Subscriptions', value: String(c?.s ?? '-'), note: 'Tracked on this device' },
                    { label: 'Transactions', value: String(c?.t ?? '-'), note: 'From imported statements' },
                    { label: 'Last import', value: profile?.last_csv_upload ? formatDate(new Date(profile.last_csv_upload).toISOString()) : 'Never', note: 'Bank statement' },
                    { label: 'Storage', value: 'Local', note: 'Private, works offline' },
                ]}
            />
            <div className="mt-8">
                <ProfileBlock />
                <SampleBlock />
                <BackupBlock />
                <DangerBlock />
            </div>
        </div>
    );
}
