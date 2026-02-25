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
        intervalType: 'monthly', // 'weekly', 'monthly', 'yearly', 'custom'
        intervalCount: '1',     // used if custom
        intervalUnit: 'month',  // 'day', 'week', 'month', 'year'
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

        let count = 1;
        let unit = 'month';

        if (formData.intervalType === 'weekly') {
            count = 1; unit = 'week';
        } else if (formData.intervalType === 'monthly') {
            count = 1; unit = 'month';
        } else if (formData.intervalType === 'yearly') {
            count = 1; unit = 'year';
        } else if (formData.intervalType === 'custom') {
            count = parseInt(formData.intervalCount, 10);
            unit = formData.intervalUnit;
            if (isNaN(count) || count <= 0) {
                alert('Please enter a valid custom interval number');
                return;
            }
        }

        let nextChargeDate = new Date(billingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate next charge date based on billing start date and interval
        // Advance the date until it is strictly in the future (after today)
        while (nextChargeDate <= today) {
            if (unit === 'day') {
                nextChargeDate.setDate(nextChargeDate.getDate() + count);
            } else if (unit === 'week') {
                nextChargeDate.setDate(nextChargeDate.getDate() + (count * 7));
            } else if (unit === 'month') {
                // To handle end-of-month correctly (e.g. Jan 31 + 1 month -> Feb 28/29)
                const expectedMonth = nextChargeDate.getMonth() + count;
                nextChargeDate.setMonth(expectedMonth);

                // If the month leaped too far because the day didn't exist in the target month
                // (e.g. going from Jan 31 to Feb 31, JS rolls it to Mar 2/3)
                // We clamp it to the last day of the expected target month.
                // The expected target month mod 12 is calculated here:
                const targetMonthIndex = (((billingDate.getMonth() + count) % 12) + 12) % 12;
                // Actually, a simpler clamp check:
                // We want to add 'count' months.
                // If we started on the 31st, and the new month doesn't have 31 days, JS pushes us to the next month.
                // It's usually easier to just recalculate from the start date, but since we are in a while loop
                // advancing sequentially, we can track the original day:
                const originalCycleDay = billingDate.getDate();
                if (nextChargeDate.getDate() !== originalCycleDay) {
                    // It rolled over. Set to last day of the *correct* destination month.
                    nextChargeDate.setDate(0);
                }
            } else if (unit === 'year') {
                nextChargeDate.setFullYear(nextChargeDate.getFullYear() + count);
            }
        }

        const nextChargeDateString = nextChargeDate.toISOString().split('T')[0];

        setLoading(true);

        try {
            const id = crypto.randomUUID();
            const now = Date.now();

            await db.execute(
                `INSERT INTO subscriptions 
          (id, name, amount, currency, interval_count, interval_unit, next_charge_date, source, confidence, active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    formData.name,
                    parseFloat(formData.amount),
                    formData.currency,
                    count,
                    unit,
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
                    <label htmlFor="intervalType" className="label block mb-1">Billing Interval</label>
                    <select
                        id="intervalType"
                        name="intervalType"
                        value={formData.intervalType}
                        onChange={handleChange}
                        className="input w-full"
                    >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom...</option>
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

            {formData.intervalType === 'custom' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div>
                        <label htmlFor="intervalCount" className="label block mb-1">Every</label>
                        <input
                            type="number"
                            id="intervalCount"
                            name="intervalCount"
                            min="1"
                            value={formData.intervalCount}
                            onChange={handleChange}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="intervalUnit" className="label block mb-1">Unit</label>
                        <select
                            id="intervalUnit"
                            name="intervalUnit"
                            value={formData.intervalUnit}
                            onChange={handleChange}
                            className="input w-full"
                        >
                            <option value="day">Days</option>
                            <option value="week">Weeks</option>
                            <option value="month">Months</option>
                            <option value="year">Years</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="pt-4 flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="btn w-full md:w-auto min-w-[120px]"
                >
                    {loading ? 'Adding...' : 'Add Subscription'}
                </button>
            </div>
        </form >
    );
}
