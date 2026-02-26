'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval_count: number;
    interval_unit: string;
    next_charge_date: string;
    active?: number;
};

type FilterType = 'all' | 'active' | 'inactive' | 'overdue' | 'due_soon';

export default function SubscriptionTable() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        let mounted = true;

        async function initWatch() {
            try {
                // Wait for DB to be potentially ready.
                // If DBInit is running in parallel, we might need a short delay or retry mechanism.
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
                    const abortController = new AbortController();

                    // Use watch to react to changes in real-time
                    (async () => {
                        try {
                            for await (const result of db.watch('SELECT * FROM subscriptions', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    // PowerSync returns rows array which we map over or cast
                                    const rows = result.rows?._array || [];
                                    setSubscriptions(rows as Subscription[]);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') {
                                console.error('Error watching subscriptions:', e);
                            }
                        }
                    })();

                    return () => {
                        abortController.abort();
                    };
                } else {
                    console.error("DB not ready after 1 second.");
                }
            } catch (e) {
                console.error("Failed to init watch for subs", e);
                if (mounted) setLoading(false);
            }
        }

        const cleanupPromise = initWatch();

        return () => {
            mounted = false;
            cleanupPromise.then(cleanup => {
                if (cleanup) cleanup();
            });
        };
    }, []);

    const toggleSubscriptionStatus = async (id: string, currentStatus: number | undefined) => {
        const newStatus = currentStatus === 0 ? 1 : 0;

        // Optimistically update the UI
        setSubscriptions(prev =>
            prev.map(sub => sub.id === id ? { ...sub, active: newStatus } : sub)
        );

        try {
            await db.execute(
                'UPDATE subscriptions SET active = ?, updated_at = ? WHERE id = ?',
                [newStatus, Date.now(), id]
            );
        } catch (error) {
            console.error('Failed to toggle subscription status', error);
            // Revert on failure
            setSubscriptions(prev =>
                prev.map(sub => sub.id === id ? { ...sub, active: currentStatus } : sub)
            );
            alert('Failed to update subscription status. Check console for details.');
        }
    };

    const formatInterval = (count: number, unit: string) => {
        if (!count || !unit) return 'Unknown';

        // Capitalize unit correctly (e.g. Month, Year)
        const capitalizedUnit = unit.charAt(0).toUpperCase() + unit.slice(1);

        if (count === 1) {
            if (unit === 'day') return 'Daily';
            if (unit === 'week') return 'Weekly';
            if (unit === 'month') return 'Monthly';
            if (unit === 'year') return 'Yearly';
            return `Every ${capitalizedUnit}`;
        }

        return `Every ${count} ${capitalizedUnit}s`;
    };

    const getRelativeTime = (dateString: string) => {
        if (!dateString) return 'N/A';
        const targetDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';

        if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            return `In ${months} month${months > 1 ? 's' : ''}`;
        }

        return `In ${diffDays} days`;
    };

    // Filter and sort subscriptions
    const filteredAndSortedSubscriptions = subscriptions
        .filter((sub) => {
            // Note: The schema has an 'active' column (integer).
            // For now, if active is undefined, assume active. 
            // In a real app, 'active' would be 1 or 0 in the DB.
            const isActive = sub.active !== 0;
            if (filter === 'active') return isActive;
            if (filter === 'inactive') return !isActive;

            if (filter === 'overdue' || filter === 'due_soon') {
                if (!sub.next_charge_date) return false;
                const targetDate = new Date(sub.next_charge_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = targetDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (filter === 'overdue') return diffDays < 0;
                if (filter === 'due_soon') return diffDays >= 0 && diffDays <= 7;
            }

            return true;
        })
        .sort((a, b) => {
            const dateA = new Date(a.next_charge_date).getTime() || Infinity;
            const dateB = new Date(b.next_charge_date).getTime() || Infinity;
            return dateA - dateB;
        });

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
        <div className="space-y-4">
            <div className="flex justify-end">
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterType)}
                    className="input py-1 px-3 text-sm max-w-xs"
                >
                    <option value="all">All Subscriptions</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due in a Week</option>
                </select>
            </div>

            <div className="overflow-x-auto ring-1 ring-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                            <th className="p-3 font-semibold text-slate-700">Merchant</th>
                            <th className="p-3 font-semibold text-slate-700">Amount</th>
                            <th className="p-3 font-semibold text-slate-700 hidden sm:table-cell">Interval</th>
                            <th className="p-3 font-semibold text-slate-700">Next Charge</th>
                            <th className="p-3 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedSubscriptions.length > 0 ? (
                            filteredAndSortedSubscriptions.map((sub) => {
                                const isActive = sub.active !== 0;
                                return (
                                    <tr key={sub.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${!isActive ? 'opacity-60' : ''}`}>
                                        <td className="p-3 font-medium text-slate-900">
                                            {sub.name}
                                            {!isActive && <span className="ml-2 text-xs font-normal text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Cancelled</span>}
                                        </td>
                                        <td className="p-3 text-slate-700">{sub.amount} {sub.currency}</td>
                                        <td className="p-3 text-slate-700 hidden sm:table-cell">
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                                {formatInterval(sub.interval_count, sub.interval_unit)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-700">
                                            {isActive ? getRelativeTime(sub.next_charge_date) : '-'}
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {sub.next_charge_date ? new Date(sub.next_charge_date).toLocaleDateString() : ''}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => toggleSubscriptionStatus(sub.id, sub.active)}
                                                className={`text-xs px-3 py-1 rounded border transition-colors ${isActive
                                                    ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                                    : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                                                    }`}
                                            >
                                                {isActive ? 'Cancel' : 'Restore'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-500">
                                    No subscriptions match the selected filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
