'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/powersync';

export default function ProfileForm() {
    const router = useRouter();
    const [id, setId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [monthlyIncome, setMonthlyIncome] = useState('');
    const [currency, setCurrency] = useState('INR');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadProfile = async () => {
            try {
                // Retry loop to wait for DB initialization
                let attempts = 0;
                let result: any = null;
                while (attempts < 10) {
                    try {
                        result = await db.getOptional('SELECT * FROM profiles LIMIT 1');
                        break; // Success
                    } catch (e: any) {
                        if (e.message?.includes('open') || e.message?.includes('initialize')) {
                            attempts++;
                            await new Promise(r => setTimeout(r, 300));
                        } else {
                            throw e;
                        }
                    }
                }

                if (mounted && result) {
                    setId(result.id);
                    setName(result.name || '');
                    setMonthlyIncome(result.monthly_income?.toString() || '');
                    setCurrency(result.currency || 'INR');
                }
            } catch (err) {
                console.error("Error loading profile", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadProfile();

        return () => { mounted = false; };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const now = Date.now();
            const incomeValue = parseFloat(monthlyIncome);
            const income = isNaN(incomeValue) ? null : incomeValue;

            if (id) {
                await db.execute(
                    'UPDATE profiles SET name = ?, monthly_income = ?, currency = ?, updated_at = ? WHERE id = ?',
                    [name, income, currency, now, id]
                );
            } else {
                const newId = crypto.randomUUID();
                await db.execute(
                    'INSERT INTO profiles (id, name, monthly_income, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [newId, name, income, currency, now, now]
                );
                setId(newId);
            }
            router.push('/');
            router.refresh();
        } catch (err) {
            console.error('Error saving profile', err);
            alert('Failed to save profile. Check console for details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 max-w-lg card p-6">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-10 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-1/4 mt-4"></div>
                <div className="h-10 bg-slate-200 rounded w-full"></div>
                <div className="h-10 bg-slate-200 rounded w-full mt-6"></div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg card p-6">
            <div>
                <label htmlFor="name" className="label block mb-1">Name</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input w-full"
                    placeholder="Your Name (e.g. Harish)"
                />
            </div>

            <div>
                <label htmlFor="monthlyIncome" className="label block mb-1">Monthly Income</label>
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                        {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}
                    </span>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*\.?[0-9]*"
                        id="monthlyIncome"
                        value={monthlyIncome}
                        onChange={(e) => {
                            if (e.target.value === '' || /^[0-9]*\.?[0-9]*$/.test(e.target.value)) {
                                setMonthlyIncome(e.target.value);
                            }
                        }}
                        className="input w-full pl-8"
                        placeholder="0.00"
                    />
                </div>
                <p className="text-xs text-slate-500 mt-1">Used to calculate subscription vs income ratio.</p>
            </div>

            <div>
                <label htmlFor="currency" className="label block mb-1">Preferred Currency</label>
                <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input w-full"
                >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                </select>
            </div>

            <div className="pt-4 flex justify-end">
                <button type="submit" disabled={saving} className="btn w-full justify-center min-w-[120px]">
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>
        </form>
    );
}
