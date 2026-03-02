'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';

type TimelineEvent = {
    id: string;
    subscriptionId: string;
    title: string;
    amount: number;
    currency: string;
    date: Date;
    isPast: boolean;
    isToday: boolean;
    category?: string;
    is_variable?: number;
};

export default function TimelineView({ subscriptions }: { subscriptions?: any[] }) {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
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
                            for await (const result of db.watch('SELECT * FROM subscriptions WHERE active = 1', [], { signal: abortController.signal })) {
                                if (mounted) {
                                    const rows = result.rows?._array || [];
                                    const timelineEvents: TimelineEvent[] = [];

                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    // Generate events for the next 60 days
                                    const futureLimit = new Date(today);
                                    futureLimit.setDate(today.getDate() + 60);

                                    // Generate events for the last 30 days
                                    const pastLimit = new Date(today);
                                    pastLimit.setDate(today.getDate() - 30);

                                    rows.forEach((row: any) => {
                                        if (row.next_charge_date) {
                                            const chargeDate = new Date(row.next_charge_date);
                                            chargeDate.setHours(0, 0, 0, 0);

                                            // If the charge date is within our window
                                            if (chargeDate >= pastLimit && chargeDate <= futureLimit) {
                                                const diffTime = chargeDate.getTime() - today.getTime();
                                                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                                                timelineEvents.push({
                                                    id: `evt-${row.id}-${chargeDate.getTime()}`,
                                                    subscriptionId: row.id,
                                                    title: row.name,
                                                    amount: row.amount || 0,
                                                    currency: row.currency || 'INR',
                                                    date: chargeDate,
                                                    isPast: diffDays < 0,
                                                    isToday: diffDays === 0,
                                                    category: row.category,
                                                    is_variable: row.is_variable
                                                });
                                            }
                                        }
                                    });

                                    // Sort chronologically
                                    timelineEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

                                    setEvents(timelineEvents);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') console.error('Error watch timeline:', e);
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

    const formatEventDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full w-full max-h-full">
            <div className="flex-none p-5 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between sticky top-0 z-10">
                <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Timeline View
                </h2>
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-medium tracking-wide">
                    Last 30 - Next 60 Days
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pr-4 custom-scrollbar relative">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="bg-[#121214] border border-zinc-800 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                        <p className="text-zinc-400 font-medium">No events found in the current window.</p>
                    </div>
                ) : (
                    <div className="relative border-l border-zinc-800 ml-4 py-4 space-y-8">
                        {events.map((event, index) => {
                            // Render a month grouping title if the month changed
                            const previousEvent = index > 0 ? events[index - 1] : null;
                            const showMonthBoundary = !previousEvent || event.date.getMonth() !== previousEvent.date.getMonth();

                            return (
                                <div key={event.id} className="relative">
                                    {showMonthBoundary && (
                                        <div className="-ml-6 mb-8 mt-2 pb-2 border-b border-zinc-800/50 inline-block pointer-events-none">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-2">
                                                {event.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    )}

                                    <div className={`relative flex items-center gap-6 group transition-opacity ${event.isPast ? 'opacity-50 hover:opacity-100' : ''}`}>

                                        {/* Timeline Dot */}
                                        <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[#121214] border-2 border-indigo-500 shadow-[0_0_0_4px_#000]" />

                                        {/* Date / Time Info */}
                                        <div className="w-24 flex-shrink-0 text-right">
                                            <p className={`text-sm font-semibold ${event.isToday ? 'text-indigo-400' : 'text-zinc-300'}`}>
                                                {event.isToday ? 'Today' : formatEventDate(event.date)}
                                            </p>
                                        </div>

                                        {/* Event Card */}
                                        <div className={`flex-1 p-4 rounded-xl border transition-colors ${event.isToday
                                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                                : 'bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800/50 hover:border-zinc-700'
                                            }`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-medium text-slate-100">{event.title}</h3>
                                                    {event.category && (
                                                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
                                                            {event.category}
                                                        </span>
                                                    )}
                                                    {event.is_variable === 1 && (
                                                        <span className="inline-block mt-1 ml-2 px-2 py-0.5 text-[10px] font-medium text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-md">
                                                            Variable
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-slate-200">
                                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: event.currency }).format(event.amount)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {event.isPast ? 'Charged' : 'Upcoming'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
