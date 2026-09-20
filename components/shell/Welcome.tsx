'use client';

import { useState } from 'react';
import { CURRENCIES } from '@/lib/currencies';
import { saveProfile } from '@/lib/profile';
import { useProfile } from '@/lib/hooks/useData';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';

/** First-run prompt. Shown until a profile with a name exists; can be skipped for this session. */
export default function Welcome() {
    const { profile, loading } = useProfile();
    const [skipped, setSkipped] = useState(false);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('INR');
    const [saving, setSaving] = useState(false);

    const open = !loading && !profile?.name && !skipped;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            await saveProfile({ name: name.trim(), monthlyIncome: profile?.monthly_income ?? null, currency });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => setSkipped(true)} title="Welcome to Subtrack" width="max-w-md">
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-ink-2">
                    Track your subscriptions and see where your money goes. Everything is stored on this device only.
                </p>
                <Field label="What should we call you?">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
                </Field>
                <Field label="Main currency">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </Select>
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setSkipped(true)}>Skip for now</Button>
                    <Button type="submit" variant="primary" disabled={!name.trim() || saving}>Get started</Button>
                </div>
            </form>
        </Dialog>
    );
}
