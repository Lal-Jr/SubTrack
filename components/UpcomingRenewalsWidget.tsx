'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/powersync';

type Subscription = {
    id: string;
    name: string;
    amount: number;
    currency: string;
    next_charge_date: string;
    active?: number;
};

export default function UpcomingRenewalsWidget() {
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
                            for await (const result of db.watch('SELECT id, name, amount, currency, next_charge_date, active FROM subscriptions', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];
                                    setSubscriptions(rows as Subscription[]);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') {
                                console.error('Error watching subscriptions for renewals:', e);
                            }
                        }
                    })();

                    return () => {
                        abortController.abort();
                    };
                }
            } catch (e) {
                console.error('Failed to init watch for renewals', e);
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

    const upcoming = useMemo(() => {
        const activeSubs = subscriptions.filter(s => s.active !== 0 && s.next_charge_date);

        // Sort by next charge date ascending
        activeSubs.sort((a, b) => new Date(a.next_charge_date).getTime() - new Date(b.next_charge_date).getTime());

        // Get the next 5 or items in the next 30 days
        const now = new Date();
        const thirtyDaysLocal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return activeSubs.filter(sub => new Date(sub.next_charge_date).getTime() <= thirtyDaysLocal.getTime()).slice(0, 4);
    }, [subscriptions]);

    if (loading) {
        return (
            <div className="flex flex-col h-full w-full justify-center">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-10 bg-white/5 rounded-lg border border-white/5 w-full"></div>
                        <div className="h-10 bg-white/5 rounded-lg border border-white/5 w-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full">
            <h2 className="text-xl font-semibold text-slate-100 flex-none mb-4 tracking-tight">Upcoming Renewals <span className="text-xs font-normal text-slate-400 ml-2">(Next 30 Days)</span></h2>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-0 w-full pr-1">
                {upcoming.length === 0 ? (
                    <div className="flex-1 min-h-[100px] flex items-center justify-center border border-dashed border-white/10 rounded-lg">
                        <p className="text-slate-400 text-sm">No upcoming renewals soon.</p>
                    </div>
                ) : (
                    upcoming.map((sub) => {
                        const dateObj = new Date(sub.next_charge_date);
                        const daysAway = Math.ceil((dateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                        let dateColor = "text-slate-400";
                        if (daysAway <= 3) dateColor = "text-rose-400 font-semibold";
                        else if (daysAway <= 7) dateColor = "text-amber-400 font-medium";

                        return (
                            <div key={sub.id} className="bg-white/5 border border-white/5 hover:border-white/10 transition-colors rounded-lg p-3 flex justify-between items-center group cursor-default">
                                <div className="min-w-0 pr-4">
                                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">{sub.name}</p>
                                    <p className={`text-xs ${dateColor} mt-0.5`}>
                                        {daysAway < 0 ? 'Overdue' : daysAway === 0 ? 'Today' : `In ${daysAway} day${daysAway > 1 ? 's' : ''}`}
                                        <span className="text-slate-500 hidden sm:inline"> • {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    </p>
                                </div>
                                <div className="text-right flex-none">
                                    <p className="text-sm font-semibold text-white">
                                        <span className="text-xs font-normal text-slate-400 mr-1">{sub.currency}</span>
                                        {sub.amount.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
