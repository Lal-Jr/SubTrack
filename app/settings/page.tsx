'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Section, Skeleton } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Segmented, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { clearAllData, downloadBackup, importBackup, type ImportMode } from '@/lib/db/backup';
import { CURRENCIES } from '@/lib/currencies';
import { useProfile } from '@/lib/hooks/useData';
import { saveProfile } from '@/lib/profile';

function ProfileCard() {
    const { profile, loading } = useProfile();
    if (loading) return <Section title="Profile"><div className="space-y-4 max-w-md"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div></Section>;
    // Keyed on the row so the form initialises from stored values once they load.
    return <ProfileForm key={profile?.id ?? 'new'} initial={profile} />;
}

function ProfileForm({ initial }: { initial: ReturnType<typeof useProfile>['profile'] }) {
    const [name, setName] = useState(initial?.name ?? '');
    const [income, setIncome] = useState(initial?.monthly_income != null ? String(initial.monthly_income) : '');
    const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
        <Section title="Profile" hint="Greeting, totals and income share">
            <form onSubmit={submit} className="space-y-4 max-w-md">
                <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); setStatus('idle'); }} /></Field>
                <Field label="Monthly income" hint="Optional. Never leaves this device.">
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={income} onChange={(e) => { setIncome(e.target.value); setStatus('idle'); }} placeholder="0" />
                </Field>
                <Field label="Main currency" hint="Totals and charts use this currency. Subscriptions in other currencies are not converted.">
                    <Select value={currency} onChange={(e) => { setCurrency(e.target.value); setStatus('idle'); }}>
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </Select>
                </Field>
                <div className="flex items-center gap-3">
                    <Button type="submit" variant="primary" disabled={status === 'saving'}>Save</Button>
                    <span role="status" className="text-sm text-ink-3">
                        {status === 'saved' && 'Saved'}{status === 'error' && <span className="text-danger">Could not save</span>}
                    </span>
                </div>
            </form>
        </Section>
    );
}

function DataCard() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<ImportMode>('merge');
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);

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
        <Section title="Your data" hint="Stored on this device only">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => downloadBackup().catch(() => setMessage({ tone: 'error', text: 'Could not create the backup.' }))}>Download backup</Button>
                    <span className="text-xs text-ink-3">A JSON file with your subscriptions, transactions and profile.</span>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium">Restore from backup</p>
                    <Segmented label="Restore mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge with current data' }, { value: 'replace', label: 'Replace current data' }]} />
                    <div>
                        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
                        <Button onClick={() => fileRef.current?.click()}>Choose backup file</Button>
                    </div>
                </div>

                {message && (
                    <p role="status" className={`text-sm rounded-xl p-3 border ${message.tone === 'ok' ? 'text-accent bg-accent-soft border-accent/30' : 'text-danger bg-danger/10 border-danger/30'}`}>{message.text}</p>
                )}

                <div className="pt-6 border-t border-line">
                    <p className="text-sm font-medium">Delete all data</p>
                    <p className="text-xs text-ink-3 mt-1 mb-3">Removes every subscription, transaction and your profile from this device. Download a backup first if you might want it back.</p>
                    <Button variant="danger" onClick={() => setConfirmClear(true)}>Delete all data</Button>
                </div>
            </div>

            <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Delete all data?" width="max-w-sm">
                <p className="text-sm text-ink-2">This permanently removes everything stored by Subtrack on this device. It cannot be undone.</p>
                <div className="flex justify-end gap-2 mt-5">
                    <Button variant="ghost" onClick={() => setConfirmClear(false)}>Keep my data</Button>
                    <Button variant="danger" onClick={async () => { await clearAllData(); setConfirmClear(false); setMessage({ tone: 'ok', text: 'All data deleted.' }); }}>Delete everything</Button>
                </div>
            </Dialog>
        </Section>
    );
}

export default function SettingsPage() {
    return (
        <div>
            <PageHeader title="Settings" />
            <div className="space-y-10">
                <ProfileCard />
                <DataCard />
                <Section title="Privacy">
                    <p className="text-sm text-ink-2 max-w-md">Subtrack works fully offline. Statements are read in your browser and nothing is uploaded anywhere.</p>
                </Section>
            </div>
        </div>
    );
}
