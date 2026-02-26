'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
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
    next_charge_date: string;
    active?: number;
};

export default function BurnDownChart() {
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

                    // Use watch to react to changes in real-time
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

    const { chartData, monthlyRate, yearlyRate } = useMemo(() => {
        if (subscriptions.length === 0) {
            return { chartData: [], monthlyRate: 0, yearlyRate: 0 };
        }

        const activeSubscriptions = subscriptions.filter(s => s.active !== 0);

        let yearlyTotal = 0;

        // Calculate normalized yearly rate for ACTIVE subs
        activeSubscriptions.forEach((sub) => {
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

            yearlyTotal += amount * chargesPerYear;
        });

        const monthlyAverage = yearlyTotal / 12;

        // Project individual charges for the past month + next 11 months
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate months
        const monthsData: { month: string; year: number; monthIndex: number; activeSpend: number; cancelledSpend: number; isForecast: boolean }[] = [];

        // Start from last month as historic
        for (let i = -1; i < 11; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            monthsData.push({
                month: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                activeSpend: 0,
                cancelledSpend: 0,
                isForecast: i > 0 // Current month and past month are not forecast. Beyond current month is forecast
            });
        }

        // Project Active Subs
        activeSubscriptions.forEach((sub) => {
            if (!sub.next_charge_date) return;

            let nextDate = new Date(sub.next_charge_date);
            const amount = sub.amount || 0;
            const count = sub.interval_count || 1;
            const unit = sub.interval_unit || 'month';

            // To simulate history for the previous month, push the nextDate back if needed
            // This is a naive simulation for demonstration of "history vs forecast"
            let simDate = new Date(nextDate);
            if (simDate > today) {
                if (unit === 'month') {
                    simDate.setMonth(simDate.getMonth() - count);
                }
            }

            const endDate = new Date(today.getFullYear(), today.getMonth() + 11, 1);
            const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

            let currentDate = simDate;
            while (currentDate < endDate) {
                if (currentDate >= startDate) {
                    // Find bucket
                    const monthDiff =
                        (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - startDate.getMonth());

                    if (monthDiff >= 0 && monthDiff < 12) {
                        monthsData[monthDiff].activeSpend += amount;
                    }
                }

                // Advance
                if (unit === 'day') {
                    currentDate.setDate(currentDate.getDate() + count);
                } else if (unit === 'week') {
                    currentDate.setDate(currentDate.getDate() + count * 7);
                } else if (unit === 'month') {
                    currentDate.setMonth(currentDate.getMonth() + count);
                } else if (unit === 'year') {
                    currentDate.setFullYear(currentDate.getFullYear() + count);
                } else {
                    break;
                }
            }
        });

        // Project Cancelled Subs (to show what we WOULD have spent)
        const cancelledSubscriptions = subscriptions.filter(s => s.active === 0);
        cancelledSubscriptions.forEach((sub) => {
            // Cancelled subs might not have a valid future next_charge_date, or it might be stale.
            // But we can project based on what they were doing
            if (!sub.next_charge_date) return;

            let nextDate = new Date(sub.next_charge_date);
            const amount = sub.amount || 0;
            const count = sub.interval_count || 1;
            const unit = sub.interval_unit || 'month';

            // Naive simulation again
            let simDate = new Date(nextDate);
            if (simDate > today && simDate.getTime() > today.getTime() + (30 * 24 * 60 * 60 * 1000)) {
                // if it's way in future, just bring it back to simulate history
                simDate.setMonth(today.getMonth());
            }

            const endDate = new Date(today.getFullYear(), today.getMonth() + 11, 1);
            const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

            let currentDate = simDate;
            while (currentDate < endDate) {
                if (currentDate >= startDate) {
                    const monthDiff =
                        (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - startDate.getMonth());

                    if (monthDiff >= 0 && monthDiff < 12) {
                        monthsData[monthDiff].cancelledSpend += amount;
                    }
                }

                if (unit === 'day') {
                    currentDate.setDate(currentDate.getDate() + count);
                } else if (unit === 'week') {
                    currentDate.setDate(currentDate.getDate() + count * 7);
                } else if (unit === 'month') {
                    currentDate.setMonth(currentDate.getMonth() + count);
                } else if (unit === 'year') {
                    currentDate.setFullYear(currentDate.getFullYear() + count);
                } else {
                    break;
                }
            }
        });

        // Format chart data
        const formattedChartData = monthsData.map((m, index) => {
            const totalWithCancellations = m.activeSpend + m.cancelledSpend;

            // Connect the historic and forecast lines at index 1 (Current month)
            const isTransitionPoint = index === 1;

            return {
                name: m.month,
                History: !m.isForecast || isTransitionPoint ? Number(m.activeSpend.toFixed(2)) : null,
                Forecast: m.isForecast || isTransitionPoint ? Number(m.activeSpend.toFixed(2)) : null,
                WithCancellations: m.cancelledSpend > 0 || totalWithCancellations > 0 ? Number(totalWithCancellations.toFixed(2)) : null,
            };
        });

        return {
            chartData: formattedChartData,
            monthlyRate: monthlyAverage,
            yearlyRate: yearlyTotal,
        };
    }, [subscriptions]);

    if (loading) {
        return (
            <div className="card p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
                <div className="h-40 bg-slate-100 rounded w-full"></div>
            </div>
        );
    }

    // Determine if we have any active subscriptions at all to show
    const hasActiveSubs = subscriptions.some(s => s.active !== 0);

    if (!hasActiveSubs) {
        return (
            <div className="card space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="text-xl font-semibold">Spend Projection</h2>
                    <div className="flex gap-6 text-sm">
                        <div>
                            <p className="text-slate-500 font-medium">Monthly Avg</p>
                            <p className="text-xl font-bold text-slate-900">₹0.00</p>
                        </div>
                        <div>
                            <p className="text-slate-500 font-medium">Yearly Total</p>
                            <p className="text-xl font-bold text-slate-900">₹0.00</p>
                        </div>
                    </div>
                </div>

                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: any, name: string | undefined) => {
                                    if (name === 'Potential Spend') return [`₹${Number(value).toFixed(2)}`, 'Without Cancellations'];
                                    return [`₹${Number(value).toFixed(2)}`, name || ''];
                                }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                            {/* Cancellations Line - Solid/Dotted Red */}
                            <Line
                                name="Potential Spend"
                                type="monotone"
                                dataKey="WithCancellations"
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    return (
        <div className="card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-semibold">Spend Projection</h2>
                <div className="flex gap-6 text-sm">
                    <div>
                        <p className="text-slate-500 font-medium">Monthly Avg</p>
                        <p className="text-xl font-bold text-slate-900">₹{monthlyRate.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-slate-500 font-medium">Yearly Total</p>
                        <p className="text-xl font-bold text-slate-900">₹{yearlyRate.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            tickFormatter={(val) => `₹${val}`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: any, name: string | undefined) => {
                                if (name === 'Potential Spend') return [`₹${Number(value).toFixed(2)}`, 'Without Cancellations'];
                                return [`₹${Number(value).toFixed(2)}`, name || ''];
                            }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                        {/* Historic Line - Solid Blue */}
                        <Line
                            name="History"
                            type="monotone"
                            dataKey="History"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                        />

                        {/* Forecast Line - Dotted Blue */}
                        <Line
                            name="Forecast"
                            type="monotone"
                            dataKey="Forecast"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                        />

                        {/* Cancellations Line - Solid/Dotted Red */}
                        <Line
                            name="Potential Spend"
                            type="monotone"
                            dataKey="WithCancellations"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
