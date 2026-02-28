'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval_count: number;
    interval_unit: string;
    active?: number;
};

export default function SpendDistributionChart() {
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
                            for await (const result of db.watch('SELECT * FROM subscriptions', [], { signal: abortController.signal })) {
                                if (mounted) {
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
                }
            } catch (e) {
                console.error('Failed to init watch for subs', e);
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

    const impactSegments = useMemo(() => {
        const activeSubscriptions = subscriptions.filter(s => s.active !== 0);

        if (activeSubscriptions.length === 0) {
            return null;
        }

        // Calculate normalized monthly cost for each sub
        const normalizedData = activeSubscriptions.map(sub => {
            const amount = sub.amount || 0;
            const count = sub.interval_count || 1;
            const unit = sub.interval_unit || 'month';

            let chargesPerYear = 0;
            if (unit === 'day') chargesPerYear = 365 / count;
            else if (unit === 'week') chargesPerYear = 52 / count;
            else if (unit === 'month') chargesPerYear = 12 / count;
            else if (unit === 'year') chargesPerYear = 1 / count;

            const monthlyCost = (amount * chargesPerYear) / 12;

            return {
                id: sub.id,
                name: sub.name || 'Unnamed',
                value: monthlyCost
            };
        });

        // Sort descending by value
        normalizedData.sort((a, b) => b.value - a.value);

        // Calculate quintiles to categorize impact mathematically rather than arbitrarily
        const maxVal = normalizedData[0].value;
        const total = normalizedData.reduce((acc, curr) => acc + curr.value, 0);

        const highImpact: typeof normalizedData = [];
        const mediumImpact: typeof normalizedData = [];
        const lowImpact: typeof normalizedData = [];

        normalizedData.forEach(item => {
            if (item.value >= maxVal * 0.5) {
                highImpact.push(item);
            } else if (item.value >= maxVal * 0.15) {
                mediumImpact.push(item);
            } else {
                lowImpact.push(item);
            }
        });

        return { highImpact, mediumImpact, lowImpact, total };
    }, [subscriptions]);

    if (loading) {
        return (
            <div className="card p-6 animate-pulse h-full">
                <div className="h-6 bg-zinc-800 rounded w-1/2 mb-6"></div>
                <div className="space-y-4">
                    <div className="h-10 bg-zinc-800 rounded-lg w-full"></div>
                    <div className="h-10 bg-zinc-800 rounded-lg w-full"></div>
                    <div className="h-10 bg-zinc-800 rounded-lg w-full"></div>
                </div>
            </div>
        );
    }

    if (!impactSegments) {
        return (
            <div className="flex flex-col h-full w-full">
                <h2 className="text-xl font-semibold text-zinc-100 flex-none mb-4">Spend Impact Breakdown</h2>
                <div className="flex-1 min-h-[150px] flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/50">
                    <p className="text-zinc-500 text-sm">No active subscriptions to analyze.</p>
                </div>
            </div>
        );
    }

    const { highImpact, mediumImpact, lowImpact, total } = impactSegments;
    const MAX_SHOWN_LOW_IMPACT = 3;

    return (
        <div className="flex flex-col h-full w-full">
            <h2 className="text-xl font-semibold text-zinc-100 flex-none mb-6">Spend Impact Breakdown</h2>

            <div className="flex-1 w-full space-y-6 overflow-y-auto pr-2 custom-scrollbar">

                {/* High Impact */}
                {highImpact.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">High Impact</h3>
                        </div>
                        <div className="space-y-2">
                            {highImpact.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-lg p-3 group hover:border-zinc-700 transition-colors">
                                    <span className="text-sm font-semibold text-zinc-200">{item.name}</span>
                                    <span className="text-sm font-semibold text-red-400">₹{item.value.toFixed(2)} / mo</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Medium Impact */}
                {mediumImpact.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Medium Impact</h3>
                        </div>
                        <div className="space-y-2">
                            {mediumImpact.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-lg p-3 group hover:border-zinc-700 transition-colors">
                                    <span className="text-sm font-medium text-zinc-300">{item.name}</span>
                                    <span className="text-sm font-medium text-amber-400">₹{item.value.toFixed(2)} / mo</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Low Impact */}
                {lowImpact.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Low Impact</h3>
                        </div>
                        <div className="space-y-2">
                            {lowImpact.slice(0, MAX_SHOWN_LOW_IMPACT).map(item => (
                                <div key={item.id} className="flex justify-between items-center border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-sm text-zinc-400">{item.name}</span>
                                    <span className="text-sm text-zinc-500">₹{item.value.toFixed(2)}</span>
                                </div>
                            ))}
                            {lowImpact.length > MAX_SHOWN_LOW_IMPACT && (
                                <div className="text-xs text-zinc-500 italic pt-1">
                                    + {lowImpact.length - MAX_SHOWN_LOW_IMPACT} more minor subscriptions
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
