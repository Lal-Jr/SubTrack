'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type CategoryData = {
    name: string;
    value: number;
};

// Vibrant color palette for categories
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];
const DEFAULT_COLOR = '#64748b';

const CATEGORY_MAPPING: Record<string, string> = {
    'Entertainment': '#ec4899',
    'Software': '#3b82f6',
    'Utilities': '#10b981',
    'Finance': '#f59e0b',
    'Shopping': '#6366f1',
    'Food & Drink': '#ef4444',
    'Other': '#8b5cf6'
};

export default function CategoryPieChartWidget() {
    const [data, setData] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function initWatch() {
            try {
                // Wait for DB ready logic (simplified for widget)
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

                    // Simple query: get active subscriptions
                    // Real app should handle currency conversion. We'll sum amounts for simplicity.
                    (async () => {
                        try {
                            for await (const result of db.watch('SELECT * FROM subscriptions WHERE active = 1', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];

                                    // Aggregate by category
                                    const categoryMap = new Map<string, number>();
                                    rows.forEach((row: any) => {
                                        const cat = row.category || 'Uncategorized';

                                        // Normalize amount to a monthly equivalent for fairer comparison
                                        let normalizedAmount = row.amount || 0;
                                        if (row.interval_unit === 'year') {
                                            normalizedAmount = normalizedAmount / 12; // Yearly to monthly
                                        } else if (row.interval_unit === 'week') {
                                            normalizedAmount = normalizedAmount * 4.33; // Weekly to monthly
                                        } else if (row.interval_unit === 'day') {
                                            normalizedAmount = normalizedAmount * 30; // Daily to monthly
                                        }

                                        const current = categoryMap.get(cat) || 0;
                                        categoryMap.set(cat, current + normalizedAmount);
                                    });

                                    const chartData = Array.from(categoryMap.entries()).map(([name, value]) => ({
                                        name,
                                        value: Number(value.toFixed(2))
                                    })).sort((a, b) => b.value - a.value);

                                    setData(chartData);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') {
                                console.error('Error watching subscriptions for pie chart:', e);
                            }
                        }
                    })();

                    return () => abortController.abort();
                }
            } catch (error) {
                console.error('Failed to init chart watch', error);
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
                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                    Category Breakdown
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="h-full flex flex-col min-h-[300px]">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                    Category Breakdown
                </h3>
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                    No active subscriptions categorized yet.
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="font-medium text-slate-200">{payload[0].name}</p>
                    <p className="text-sm text-indigo-400 font-semibold mt-1">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'INR' }).format(payload[0].value)}/mo
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col min-h-[320px]">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                Category Breakdown
            </h3>
            <p className="text-xs text-zinc-400 mb-4 ml-4">Estimated monthly spend by category</p>

            <div className="flex-1 w-full relative min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={CATEGORY_MAPPING[entry.name] || COLORS[index % COLORS.length] || DEFAULT_COLOR}
                                    className="transition-all duration-300 hover:opacity-80 drop-shadow-sm"
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-xs text-zinc-300 ml-1">{value}</span>}
                            wrapperStyle={{ paddingTop: '20px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
