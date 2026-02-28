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
            <h2 className="text-xl font-semibold text-slate-100 flex-none mb-4">Quick Stats</h2>

            <div className="flex-1 min-h-[100px] grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                    <p className="text-sm font-medium text-slate-400 relative z-10">Active</p>
                    <p className="text-2xl lg:text-3xl font-bold text-white relative z-10 shadow-black/50 drop-shadow-sm">{stats.activeCount}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                    <p className="text-sm font-medium text-slate-400 relative z-10">Monthly Avg</p>
                    <p className="text-2xl lg:text-3xl font-bold text-white relative z-10 shadow-black/50 drop-shadow-sm">₹{stats.monthly.toFixed(2)}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
                    <p className="text-sm font-medium text-slate-400 relative z-10">Yearly Total</p>
                    <p className="text-2xl lg:text-3xl font-bold text-white relative z-10 shadow-black/50 drop-shadow-sm">₹{stats.yearly.toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
}
