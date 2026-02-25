'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval_days: number;
    next_charge_date: string;
};

export default function SubscriptionTable() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadData() {
            try {
                // Wait for DB to be potentially ready.
                // If DBInit is running in parallel, we might need a short delay or retry mechanism.
                // We'll use a simple retry up to 10 times (1 second)
                let retries = 0;
                let ready = false;
                while (retries < 10 && !ready) {
                    try {
                        // Try a simple query to see if DB is ready
                        await db.execute('SELECT 1');
                        ready = true;
                    } catch {
                        await new Promise(r => setTimeout(r, 100));
                        retries++;
                    }
                }

                if (ready) {
                    const result = await db.getAll('SELECT * FROM subscriptions ORDER BY next_charge_date ASC');
                    if (mounted) {
                        setSubscriptions(result as Subscription[]);
                    }
                } else {
                    console.error("DB not ready after 1 second.");
                }
            } catch (e) {
                console.error("Failed to load subs", e);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadData();

        return () => {
            mounted = false;
        };
    }, []);

    if (loading) {
        return <div className="p-4 text-center text-slate-500">Loading subscriptions...</div>;
    }

    if (subscriptions.length === 0) {
        return (
            <div className="p-4 text-center border border-dashed border-slate-300 rounded-lg">
                <p className="text-slate-500">No subscriptions found.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto ring-1 ring-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                        <th className="p-3 font-semibold text-slate-700">Merchant</th>
                        <th className="p-3 font-semibold text-slate-700">Amount</th>
                        <th className="p-3 font-semibold text-slate-700 hidden sm:table-cell">Interval (Days)</th>
                        <th className="p-3 font-semibold text-slate-700">Next Charge Date</th>
                    </tr>
                </thead>
                <tbody>
                    {subscriptions.map((sub) => (
                        <tr key={sub.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-900">{sub.name}</td>
                            <td className="p-3 text-slate-700">{sub.amount} {sub.currency}</td>
                            <td className="p-3 text-slate-700 hidden sm:table-cell">{sub.interval_days}</td>
                            <td className="p-3 text-slate-700">
                                {sub.next_charge_date ? new Date(sub.next_charge_date).toLocaleDateString() : 'N/A'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
