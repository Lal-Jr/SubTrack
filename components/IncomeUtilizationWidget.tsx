'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';
import Link from 'next/link';

type Subscription = {
    amount: number;
    interval_count: number;
    interval_unit: string;
    active?: number;
};

type Profile = {
    monthly_income: number | null;
    currency: string;
};

export default function IncomeUtilizationWidget() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
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
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') console.error('Error watching subscriptions:', e);
                        }
                    })();

                    (async () => {
                        try {
                            for await (const result of db.watch('SELECT monthly_income, currency FROM profiles LIMIT 1', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];
                                    if (rows.length > 0) {
                                        setProfile(rows[0] as Profile);
                                    }
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') console.error('Error watching profiles:', e);
                        }
                    })();

                    return () => abortController.abort();
                }
            } catch (e) {
                console.error('Failed to init watch for income widget', e);
                if (mounted) setLoading(false);
            }
        }

        const cleanupPromise = initWatch();
        return () => {
            mounted = false;
            cleanupPromise.then(cleanup => { if (cleanup) cleanup(); });
        };
    }, []);

    const { monthlySpend, income, utilizedPercent, remaining } = useMemo(() => {
        const activeSubs = subscriptions.filter(s => s.active !== 0);
        let totalMonthly = 0;

        activeSubs.forEach(sub => {
            const amount = sub.amount || 0;
            const count = sub.interval_count || 1;
            const unit = sub.interval_unit || 'month';

            let chargesPerYear = 0;
            if (unit === 'day') chargesPerYear = 365 / count;
            else if (unit === 'week') chargesPerYear = 52 / count;
            else if (unit === 'month') chargesPerYear = 12 / count;
            else if (unit === 'year') chargesPerYear = 1 / count;

            totalMonthly += (amount * chargesPerYear) / 12;
        });

        const userIncome = profile?.monthly_income || 0;
        const percent = userIncome > 0 ? Math.min((totalMonthly / userIncome) * 100, 100) : 0;
        const left = Math.max(userIncome - totalMonthly, 0);

        return {
            monthlySpend: totalMonthly,
            income: userIncome,
            utilizedPercent: percent,
            remaining: left
        };
    }, [subscriptions, profile]);

    if (loading) {
        return (
            <div className="flex flex-col h-full w-full justify-center">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
                    <div className="h-12 bg-white/5 rounded w-full"></div>
                </div>
            </div>
        );
    }

    if (!profile?.monthly_income || profile.monthly_income <= 0) {
        return (
            <div className="flex flex-col h-full w-full">
                <h2 className="text-xl font-semibold text-slate-100 flex-none mb-4">Income Utilization</h2>
                <div className="flex-1 min-h-[100px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg p-6 text-center">
                    <p className="text-slate-400 text-sm mb-3">Add your monthly income to see budget insights.</p>
                    <Link href="/profile" className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium">Update Profile &rarr;</Link>
                </div>
            </div>
        );
    }

    // Determine color based on utilization
    let progressColor = "bg-emerald-500";
    if (utilizedPercent > 50) progressColor = "bg-amber-500";
    if (utilizedPercent > 80) progressColor = "bg-rose-500";

    return (
        <div className="flex flex-col h-full w-full justify-between">
            <h2 className="text-xl font-semibold text-slate-100 flex-none mb-4">Income vs Subscriptions</h2>

            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full gap-5">

                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Total Spend</p>
                        <p className="text-xl font-bold text-white">₹{monthlySpend.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-slate-400">Monthly Income</p>
                        <p className="text-xl font-bold text-white">₹{income.toFixed(2)}</p>
                    </div>
                </div>

                <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold inline-block text-white">
                                {utilizedPercent.toFixed(1)}% Utilized
                            </span>
                        </div>
                    </div>
                    <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-800 border border-white/5 box-content relative">
                        {/* Glow effect for progress bar */}
                        <div style={{ width: `${utilizedPercent}%` }} className={`absolute inset-y-0 left-0 blur-sm opacity-50 ${progressColor}`}></div>
                        <div style={{ width: `${utilizedPercent}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center z-10 transition-all duration-1000 ${progressColor}`}></div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-400 mb-1">Remaining Budget</p>
                    <p className="text-2xl font-bold text-emerald-400 drop-shadow-sm">₹{remaining.toFixed(2)}</p>
                </div>

            </div>
        </div>
    );
}
