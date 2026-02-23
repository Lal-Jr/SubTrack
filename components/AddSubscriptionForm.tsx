'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/powersync';

export default function AddSubscriptionForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        currency: 'USD',
        intervalDays: '30',
        nextChargeDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const id = crypto.randomUUID();
            const now = Date.now();

            await db.execute(
                `INSERT INTO subscriptions 
          (id, name, amount, currency, interval_days, next_charge_date, source, confidence, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    formData.name,
                    parseFloat(formData.amount),
                    formData.currency,
                    parseInt(formData.intervalDays, 10),
                    formData.nextChargeDate,
                    'manual',
                    1.0, // confidence
                    1,   // active
                    now,
                    now
                ]
            );

            router.push('/');
            router.refresh(); // Refresh the dashboard if it fetches data
        } catch (error) {
            console.error('Failed to add subscription', error);
            alert('Failed to add subscription. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="label block mb-1">Subscription Name</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="e.g., Netflix, Spotify"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="amount" className="label block mb-1">Amount</label>
                    <input
                        type="number"
                        id="amount"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        required
                        step="0.01"
                        min="0"
                        className="input"
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label htmlFor="currency" className="label block mb-1">Currency</label>
                    <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="input w-full"
                    >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="intervalDays" className="label block mb-1">Billing Interval</label>
                    <select
                        id="intervalDays"
                        name="intervalDays"
                        value={formData.intervalDays}
                        onChange={handleChange}
                        className="input w-full"
                    >
                        <option value="7">Weekly (7 days)</option>
                        <option value="30">Monthly (30 days)</option>
                        <option value="365">Yearly (365 days)</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="nextChargeDate" className="label block mb-1">Next Charge Date</label>
                    <input
                        type="date"
                        id="nextChargeDate"
                        name="nextChargeDate"
                        value={formData.nextChargeDate}
                        onChange={handleChange}
                        required
                        className="input"
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="btn w-full md:w-auto min-w-[120px]"
                >
                    {loading ? 'Adding...' : 'Add Subscription'}
                </button>
            </div>
        </form>
    );
}
