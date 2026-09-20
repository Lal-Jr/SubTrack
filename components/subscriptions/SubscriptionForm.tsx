'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { CATEGORIES } from '@/lib/chartColors';
import { CURRENCIES } from '@/lib/currencies';
import { nextChargeOnOrAfter, todayUtc } from '@/lib/subscriptions/schedule';
import { createSubscription, updateSubscription, type SubscriptionInput } from '@/lib/subscriptions/store';
import type { SubscriptionRow } from '@/lib/subscriptions/types';
import { formatDay, parseDay } from '@/lib/detection/dates';

type Preset = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

const PRESETS: Record<Exclude<Preset, 'custom'>, { count: number; unit: string }> = {
    weekly: { count: 1, unit: 'week' },
    monthly: { count: 1, unit: 'month' },
    quarterly: { count: 3, unit: 'month' },
    yearly: { count: 1, unit: 'year' },
};

function presetFor(count: number, unit: string): Preset {
    const hit = (Object.entries(PRESETS) as [Exclude<Preset, 'custom'>, { count: number; unit: string }][]).find(([, p]) => p.count === count && p.unit === unit);
    return hit ? hit[0] : 'custom';
}

interface Props {
    existing?: SubscriptionRow;
    defaultCurrency: string;
    onDone: () => void;
    onDelete?: () => void;
    /** Marks an existing subscription cancelled, or resumes it. */
    onToggleActive?: () => void;
}

export default function SubscriptionForm({ existing, defaultCurrency, onDone, onDelete, onToggleActive }: Props) {
    const count0 = existing?.interval_count ?? 1;
    const unit0 = existing?.interval_unit ?? 'month';
    const next0 = existing ? nextChargeOnOrAfter(existing, todayUtc()) : null;

    const [name, setName] = useState(existing?.name ?? '');
    const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : '');
    const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
    const [preset, setPreset] = useState<Preset>(existing ? presetFor(count0, unit0) : 'monthly');
    const [customCount, setCustomCount] = useState(String(count0));
    const [customUnit, setCustomUnit] = useState(unit0);
    const [nextDate, setNextDate] = useState(next0 ? formatDay(next0) : formatDay(todayUtc()));
    const [category, setCategory] = useState(existing?.category ?? '');
    const [isVariable, setVariable] = useState(existing?.is_variable === 1);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = Number(amount);
        const interval = preset === 'custom' ? { count: Math.floor(Number(customCount)), unit: customUnit } : PRESETS[preset];
        if (!name.trim()) return setError('Enter a name.');
        if (!Number.isFinite(value) || value <= 0) return setError('Amount must be greater than 0.');
        if (!Number.isInteger(interval.count) || interval.count < 1) return setError('The repeat interval must be a whole number of 1 or more.');
        if (Number.isNaN(parseDay(nextDate))) return setError('Enter a valid date for the next charge.');

        const input: SubscriptionInput = {
            name: name.trim(),
            amount: value,
            currency,
            intervalCount: interval.count,
            intervalUnit: interval.unit,
            nextChargeDate: nextDate,
            category: category || null,
            isVariable,
        };
        setSaving(true);
        setError(null);
        try {
            if (existing) await updateSubscription(existing.id, input);
            else await createSubscription(input);
            onDone();
        } catch (err) {
            console.error('Saving subscription failed', err);
            setError('Could not save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-3">{error}</p>}

            <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" autoFocus={!existing} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <Field label="Amount per charge">
                        <Input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="199" />
                    </Field>
                </div>
                <Field label="Currency">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </Select>
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Repeats">
                    <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Every 3 months</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom…</option>
                    </Select>
                </Field>
                <Field label="Next charge date">
                    <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                </Field>
            </div>

            {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Every">
                        <Input type="number" min="1" step="1" value={customCount} onChange={(e) => setCustomCount(e.target.value)} />
                    </Field>
                    <Field label="Unit">
                        <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                            <option value="day">Days</option>
                            <option value="week">Weeks</option>
                            <option value="month">Months</option>
                            <option value="year">Years</option>
                        </Select>
                    </Field>
                </div>
            )}

            <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">No category</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
            </Field>

            <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={isVariable} onChange={(e) => setVariable(e.target.checked)} className="accent-[#dcff4d] w-4 h-4" />
                The amount changes from charge to charge
            </label>

            <div className="flex items-center justify-between pt-2">
                {existing && onDelete ? (
                    <div className="flex gap-2">
                        {onToggleActive && <Button onClick={onToggleActive}>{existing.active === 0 ? 'Resume' : 'Mark cancelled'}</Button>}
                        <Button variant="danger" onClick={onDelete}>Delete</Button>
                    </div>
                ) : <span />}
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onDone}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={saving}>{existing ? 'Save changes' : 'Add subscription'}</Button>
                </div>
            </div>
        </form>
    );
}
