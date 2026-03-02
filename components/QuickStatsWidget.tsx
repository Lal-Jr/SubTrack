'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';

type Subscription = {
    amount: number;
    interval_count: number;
    interval_unit: string;
    active?: number;
};

export default function QuickStatsWidget() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function initWatch() {
            try {
                let retries = 0;
                let ready = false;
                while (retries < 10 && !ready) {
                    try {
                        await db.execute('SELECT 1');
                        ready = true;
                    } catch {
                        await new Promise((r) => setTimeout(r, 100));
                        retries++;
                    }
                }

                if (ready) {
                    const abortController = new AbortController();

                    (async () => {
                        try {
                            for await (const result of db.watch('SELECT amount, interval_count, interval_unit, active FROM subscriptions', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];
                                    setSubscriptions(rows as Subscription[]);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') {
                                console.error('Error watching subscriptions for stats:', e);
                            }
                        }
                    })();

                    return () => {
                        abortController.abort();
                    };
                }
            } catch (e) {
                console.error('Failed to init watch for stats', e);
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

    const stats = useMemo(() => {
        const activeSubs = subscriptions.filter(s => s.active !== 0);

        let totalMonthly = 0;
        let totalYearly = 0;

        activeSubs.forEach(sub => {
            const amount = sub.amount || 0;
            const count = sub.interval_count || 1;
            const unit = sub.interval_unit || 'month';

            let chargesPerYear = 0;
            if (unit === 'day') {
                chargesPerYear = 365 / count;
            } else if (unit === 'week') {
                chargesPerYear = 52 / count;
            } else if (unit === 'month') {
                chargesPerYear = 12 / count;
            } else if (unit === 'year') {
                chargesPerYear = 1 / count;
            }

            const yearly = amount * chargesPerYear;
            totalYearly += yearly;
            totalMonthly += (yearly / 12);
        });

        return {
            activeCount: activeSubs.length,
            monthly: totalMonthly,
            yearly: totalYearly
        };
    }, [subscriptions]);

    if (loading) {
        return (
            <div className="flex flex-col h-full w-full justify-center">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="h-20 bg-white/5 rounded-lg border border-white/5"></div>
                        <div className="h-20 bg-white/5 rounded-lg border border-white/5"></div>
                        <div className="h-20 bg-white/5 rounded-lg border border-white/5"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <h2 className="text-lg font-semibold text-zinc-100">Overview</h2>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Active Plans Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#121214] border border-zinc-800/80 p-5 group shadow-lg transition-all hover:border-indigo-500/30">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-colors"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">Active</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-zinc-400 mb-1">Total Subscriptions</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight">{stats.activeCount}</p>
                    </div>
                </div>

                {/* Monthly Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#121214] border border-zinc-800/80 p-5 group shadow-lg transition-all hover:border-emerald-500/30">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-colors"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">Est. Average</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-zinc-400 mb-1">Per Month</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight">₹{stats.monthly.toFixed(0)}</p>
                    </div>
                </div>

                {/* Yearly Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#121214] border border-zinc-800/80 p-5 group shadow-lg transition-all hover:border-rose-500/30">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/20 rounded-full blur-2xl group-hover:bg-rose-500/30 transition-colors"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">Commitment</span>
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-zinc-400 mb-1">Total Per Year</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight">₹{stats.yearly.toFixed(0)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
