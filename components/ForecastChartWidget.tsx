'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ForecastChartWidget() {
    const [data, setData] = useState<any[]>([]);
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
                        await new Promise(r => setTimeout(r, 100));
                        retries++;
                    }
                }

                if (ready) {
                    const abortController = new AbortController();

                    (async () => {
                        try {
                            // We need both active and inactive to accurately represent the PAST
                            for await (const result of db.watch('SELECT * FROM subscriptions', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];

                                    // Calculate forecast for -3 months to +3 months
                                    const today = new Date();
                                    const currentMonth = today.getMonth();
                                    const currentYear = today.getFullYear();

                                    const forecastData = [];

                                    for (let i = -3; i <= 3; i++) {
                                        const targetDate = new Date(currentYear, currentMonth + i, 1);
                                        const monthLabel = targetDate.toLocaleString('default', { month: 'short' }) + ' ' + targetDate.getFullYear().toString().slice(-2);

                                        let monthlyTotal = 0;

                                        rows.forEach((row: any) => {
                                            if (!row.amount) return;

                                            // If looking at a FUTURE month, ONLY count if active=1
                                            if (i > 0 && row.active !== 1) {
                                                return;
                                            }

                                            // If looking at a PAST or CURRENT month, we could theoretically 
                                            // exclude it if it was created AFTER this month or cancelled BEFORE this month.
                                            // For simplicity in a basic "Spend Projection", we assume it was paid 
                                            // if it existed in the past. (A robust ledger would check created_at / last_charge).

                                            // Simple normalized monthly calculation
                                            let normalizedAmount = row.amount || 0;

                                            if (row.interval_unit === 'year') {
                                                normalizedAmount = normalizedAmount / 12;
                                            } else if (row.interval_unit === 'week') {
                                                normalizedAmount = normalizedAmount * 4.33;
                                            } else if (row.interval_unit === 'day') {
                                                normalizedAmount = normalizedAmount * 30;
                                            }

                                            monthlyTotal += normalizedAmount;
                                        });

                                        forecastData.push({
                                            name: monthLabel,
                                            Projected: Number(monthlyTotal.toFixed(2)),
                                            isFuture: i > 0
                                        });
                                    }

                                    console.log("FORECAST DATA:", forecastData.length, forecastData);
                                    setData(forecastData);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') console.error('Error watching for forecast:', e);
                        }
                    })();

                    return () => abortController.abort();
                }
            } catch (error) {
                if (mounted) setLoading(false);
            }
        }

        const cleanupPromise = initWatch();
        return () => {
            mounted = false;
            cleanupPromise.then(cleanup => { if (cleanup) cleanup(); });
        };
    }, []);

    if (loading) {
        return (
            <div className="h-full flex flex-col min-h-[300px]">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    3-Month Forecast
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="font-medium text-slate-200">{label}</p>
                    <p className="text-sm text-emerald-400 font-semibold mt-1">
                        Est: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR' }).format(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col min-h-[320px]">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                6-Month Spend Timeline
            </h3>
            <p className="text-xs text-zinc-400 mb-6 ml-4">Historical vs Projected commitments</p>

            <div className="flex-1 w-full relative min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={0}
                        />
                        <YAxis
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${value}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="Projected"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorForecast)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
