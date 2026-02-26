'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval_count: number;
    interval_unit: string;
    active?: number;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

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

    const chartData = useMemo(() => {
        const activeSubscriptions = subscriptions.filter(s => s.active !== 0);

        if (activeSubscriptions.length === 0) {
            return [];
        }

        // Calculate normalized monthly cost for each sub
        const normalizedData = activeSubscriptions.map(sub => {
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

            const yearlyTotal = amount * chargesPerYear;
            const monthlyCost = yearlyTotal / 12;

            return {
                name: sub.name || 'Unnamed',
                value: monthlyCost
            };
        });

        // Sort descending by value
        normalizedData.sort((a, b) => b.value - a.value);

        // Group into top N and "Others"
        const MAX_ITEMS = 5;
        if (normalizedData.length > MAX_ITEMS) {
            const topItems = normalizedData.slice(0, MAX_ITEMS - 1);
            const others = normalizedData.slice(MAX_ITEMS - 1).reduce(
                (acc, curr) => ({
                    name: 'Others',
                    value: acc.value + curr.value
                }),
                { name: 'Others', value: 0 }
            );

            return [...topItems, others].map(item => ({
                ...item,
                value: Number(item.value.toFixed(2))
            }));
        }

        return normalizedData.map(item => ({
            ...item,
            value: Number(item.value.toFixed(2))
        }));
    }, [subscriptions]);

    if (loading) {
        return (
            <div className="card p-6 animate-pulse h-full">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="h-40 bg-slate-100 rounded w-full rounded-full w-40 h-40 mx-auto"></div>
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="card space-y-4 h-full flex flex-col">
                <h2 className="text-xl font-semibold">Spend Breakdown</h2>
                <div className="flex-1 flex items-center justify-center border border-dashed border-slate-300 rounded-lg py-12">
                    <p className="text-slate-500 text-sm">No active subscriptions to analyze.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card space-y-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold">Spend Breakdown <span className="text-xs font-normal text-slate-500 ml-2">(Monthly Avg)</span></h2>

            <div className="flex-1 min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number | undefined) => [`₹${(value || 0).toFixed(2)}`, 'Monthly Equivalent']}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
