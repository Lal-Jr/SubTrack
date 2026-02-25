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
        currency: 'INR',
        intervalDays: '30',
        billingStartDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const parsedAmount = parseFloat(formData.amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Amount must be greater than 0');
            return;
        }

        const billingDate = new Date(formData.billingStartDate);
        if (isNaN(billingDate.getTime())) {
            alert('Please enter a valid billing date');
            return;
        }

        const intervalDays = parseInt(formData.intervalDays, 10);
        let nextChargeDate = new Date(billingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate next charge date based on billing start date and interval
        while (nextChargeDate <= today) {
            nextChargeDate.setDate(nextChargeDate.getDate() + intervalDays);
        }

        const nextChargeDateString = nextChargeDate.toISOString().split('T')[0];

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
                    intervalDays,
                    nextChargeDateString,
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
                <label htmlFor="name" className="label block mb-1">Merchant Name</label>
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
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        id="amount"
                        name="amount"
                        value={formData.amount}
                        onChange={(e) => {
                            if (e.target.value === '' || /^[0-9]+$/.test(e.target.value)) {
                                handleChange(e);
                            }
                        }}
                        required
                        className="input"
                        placeholder="0"
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
                    <label htmlFor="billingStartDate" className="label block mb-1">Billing Date</label>
                    <input
                        type="date"
                        id="billingStartDate"
                        name="billingStartDate"
                        value={formData.billingStartDate}
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
