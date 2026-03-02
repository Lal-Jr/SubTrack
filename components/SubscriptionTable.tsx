'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';
import AddSubscriptionModal from '@/components/AddSubscriptionModal';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval_count: number;
    interval_unit: string;
    next_charge_date: string;
    active?: number;
    category?: string;
    tags?: string;
    is_variable?: number;
};

type FilterType = 'all' | 'active' | 'inactive' | 'overdue' | 'due_soon';

export default function SubscriptionTable() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

    const handleMarkPaid = async (sub: Subscription) => {
        if (!sub.next_charge_date) return;

        let date = new Date(sub.next_charge_date);
        const count = sub.interval_count || 1;
        const unit = sub.interval_unit || 'month';

        if (unit === 'day') {
            date.setDate(date.getDate() + count);
        } else if (unit === 'week') {
            date.setDate(date.getDate() + (count * 7));
        } else if (unit === 'month') {
            date.setMonth(date.getMonth() + count);
        } else if (unit === 'year') {
            date.setFullYear(date.getFullYear() + count);
        }

        const newChargeDate = date.toISOString();

        // Optimistically update
        setSubscriptions(prev =>
            prev.map(s => s.id === sub.id ? { ...s, next_charge_date: newChargeDate } : s)
        );

        try {
            await db.execute(
                'UPDATE subscriptions SET next_charge_date = ?, updated_at = ? WHERE id = ?',
                [newChargeDate, Date.now(), sub.id]
            );
        } catch (error) {
            console.error('Failed to mark as paid', error);
            // Revert
            setSubscriptions(prev =>
                prev.map(s => s.id === sub.id ? { ...s, next_charge_date: sub.next_charge_date } : s)
            );
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

            // For all other filters (overdue, due_soon), explicitly hide inactive items
            if (!isActive && filter !== 'all') return false;

            if (filter === 'overdue' || filter === 'due_soon') {
                if (!sub.next_charge_date) return false;
                const targetDate = new Date(sub.next_charge_date);
                const today = new Date();
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
        <div className="flex flex-col h-full w-full max-h-full">
            <div className="flex-none p-5 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        Your Subscriptions
                    </h2>
                    <button onClick={() => setIsAddModalOpen(true)} className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 p-1 rounded border border-transparent hover:border-indigo-500/30" title="Add Subscription">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterType)}
                    className="input py-1.5 px-3 text-sm max-w-[160px] bg-white/5 border-white/10 m-0"
                >
                    <option value="all">All Subscriptions</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due in a Week</option>
                </select>
            </div>

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto p-5 custom-scrollbar">
                {filteredAndSortedSubscriptions.length > 0 ? (
                    filteredAndSortedSubscriptions.map((sub) => {
                        const isActive = sub.active !== 0;
                        return (
                            <div
                                key={sub.id}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isActive
                                    ? 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
                                    : 'border-white/5 bg-black/20 opacity-60 grayscale'
                                    }`}
                            >
                                {/* Left Side: Merchant & Amount */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center font-bold text-indigo-300 text-lg">
                                        {sub.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                                            {sub.name}
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-0.5 font-medium">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: sub.currency }).format(sub.amount)}{' '}
                                            <span className="text-slate-500 font-normal ml-1">• {formatInterval(sub.interval_count, sub.interval_unit)}</span>
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                            {sub.category && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide bg-indigo-500/10 text-indigo-300 rounded-md border border-indigo-500/20">
                                                    {sub.category}
                                                </span>
                                            )}
                                            {sub.is_variable === 1 && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide bg-orange-500/10 text-orange-300 rounded-md border border-orange-500/20">
                                                    Variable
                                                </span>
                                            )}
                                            {sub.tags && sub.tags.split(',').map((tag, i) => tag.trim() && (
                                                <span key={i} className="px-2 py-0.5 text-[10px] font-medium tracking-wide bg-white/5 text-slate-300 rounded-md border border-white/10">
                                                    #{tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Status & Actions */}
                                <div className="flex items-center gap-5 md:gap-8 text-right">
                                    <div className="hidden sm:block">
                                        <p className="text-sm font-medium text-slate-200">
                                            {!isActive ? (
                                                <span className="text-red-400">Cancelled</span>
                                            ) : (
                                                getRelativeTime(sub.next_charge_date)
                                            )}
                                        </p>
                                        {isActive && (
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {sub.next_charge_date ? new Date(sub.next_charge_date).toLocaleDateString() : 'N/A'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => toggleSubscriptionStatus(sub.id, sub.active)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-200 border w-[72px] ${isActive
                                                ? 'border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                                                : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-300'
                                                }`}
                                        >
                                            {isActive ? 'Cancel' : 'Restore'}
                                        </button>

                                        {isActive && sub.next_charge_date && getRelativeTime(sub.next_charge_date) === 'Overdue' && (
                                            <button
                                                onClick={() => handleMarkPaid(sub)}
                                                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-200 border w-[72px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                            >
                                                Mark Paid
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center rounded-xl border border-dashed border-white/10 bg-white/5 mt-4">
                        <p className="text-slate-400">No subscriptions match the selected filter.</p>
                    </div>
                )}
            </div>

            <AddSubscriptionModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
        </div>
    );
}
