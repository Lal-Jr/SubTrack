'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/powersync';

type DayData = {
    date: number;
    hasRenewal: boolean;
    count: number;
    amount: number;
    isToday: boolean;
    isPast: boolean;
};

export default function RenewalCalendarWidget() {
    const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
    const [currentMonthName, setCurrentMonthName] = useState('');
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

                                    const today = new Date();
                                    const year = today.getFullYear();
                                    const month = today.getMonth();

                                    setCurrentMonthName(today.toLocaleString('default', { month: 'long', year: 'numeric' }));

                                    // Number of days in the current month
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                                    // Map renewal counts per day for the current month
                                    const renewalMap = new Map<number, { count: number, amount: number }>();

                                    rows.forEach((row: any) => {
                                        if (row.next_charge_date) {
                                            const chargeDate = new Date(row.next_charge_date);
                                            // Only count if it's this month and this year
                                            if (chargeDate.getMonth() === month && chargeDate.getFullYear() === year) {
                                                const day = chargeDate.getDate();
                                                const current = renewalMap.get(day) || { count: 0, amount: 0 };

                                                let amt = row.amount || 0;
                                                // Simplified conversion...
                                                renewalMap.set(day, {
                                                    count: current.count + 1,
                                                    amount: current.amount + amt
                                                });
                                            }
                                        }
                                    });

                                    const generatedDays: DayData[] = [];
                                    const currentDay = today.getDate();

                                    for (let i = 1; i <= daysInMonth; i++) {
                                        const renewalInfo = renewalMap.get(i);
                                        generatedDays.push({
                                            date: i,
                                            hasRenewal: !!renewalInfo,
                                            count: renewalInfo?.count || 0,
                                            amount: renewalInfo?.amount || 0,
                                            isToday: i === currentDay,
                                            isPast: i < currentDay
                                        });
                                    }

                                    setCalendarDays(generatedDays);
                                    setLoading(false);
                                }
                            }
                        } catch (e: any) {
                            if (e.name !== 'AbortError') console.error('Error watch renewal cal:', e);
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
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                    Renewal Calendar
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    // Determine offset for the first day of the month to align correctly in a 7-col grid
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
    const emptyCells = Array.from({ length: firstDay }).map((_, i) => (
        <div key={`empty-${i}`} className="p-2 border border-transparent rounded-lg"></div>
    ));

    return (
        <div className="h-full flex flex-col min-h-[340px]">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    Renewal Calendar
                </h3>
                <span className="text-sm font-medium text-zinc-300 bg-zinc-800/80 px-3 py-1 rounded-full">
                    {currentMonthName}
                </span>
            </div>
            <p className="text-xs text-zinc-400 mb-6 ml-4">Monthly visual schedule</p>

            <div className="flex-1 w-full bg-zinc-900/40 rounded-xl border border-zinc-800 p-4">
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                    {emptyCells}
                    {calendarDays.map(day => (
                        <div
                            key={`day-${day.date}`}
                            className={`relative group aspect-square flex flex-col items-center justify-center rounded-lg border transition-all duration-200 cursor-default
                                ${day.isToday ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800/50 bg-black/20 hover:border-zinc-700 hover:bg-zinc-800'}
                                ${day.isPast ? 'opacity-50 grayscale' : ''}
                            `}
                        >
                            <span className={`text-sm font-medium ${day.isToday ? 'text-indigo-400' : 'text-zinc-300'}`}>
                                {day.date}
                            </span>

                            {day.hasRenewal && (
                                <div className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                                    {Array.from({ length: Math.min(day.count, 3) }).map((_, i) => (
                                        <div key={i} className="w-1 h-1 rounded-full bg-cyan-400"></div>
                                    ))}
                                    {day.count > 3 && <span className="text-[8px] text-cyan-400 leading-none">+</span>}
                                </div>
                            )}

                            {/* Tooltip */}
                            {day.hasRenewal && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-800 border border-zinc-700 text-xs rounded shadow-xl p-2 z-10 pointer-events-none">
                                    <p className="font-semibold text-zinc-200">{day.count} Renewal{day.count > 1 ? 's' : ''}</p>
                                    <p className="text-cyan-400">Est. ₹{day.amount}</p>
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
