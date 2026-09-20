'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { categoryColor } from '@/lib/chartColors';
import { addMonths, formatDay } from '@/lib/detection/dates';
import { formatMajor } from '@/lib/format';
import { chargesBetween, todayUtc } from '@/lib/subscriptions/schedule';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 86_400_000;

export default function RenewalCalendar({ subs, currency }: { subs: SubscriptionRow[]; currency: string }) {
    const today = todayUtc();
    const [offset, setOffset] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);

    const t = new Date(today);
    const monthStart = addMonths(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1), offset);
    const monthEnd = addMonths(monthStart, 1) - DAY;
    const lead = new Date(monthStart).getUTCDay();
    const daysInMonth = new Date(monthEnd).getUTCDate();

    const byDay = useMemo(() => {
        const map = new Map<string, SubscriptionRow[]>();
        for (const s of subs.filter(isActive)) {
            for (const d of chargesBetween(s, monthStart, monthEnd)) {
                const key = formatDay(d);
                map.set(key, [...(map.get(key) ?? []), s]);
            }
        }
        return map;
    }, [subs, monthStart, monthEnd]);

    const label = new Date(monthStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const picked = selected ? byDay.get(selected) ?? [] : [];

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium" aria-live="polite">{label}</p>
                <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setOffset((o) => o - 1); setSelected(null); }} aria-label="Previous month">‹</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setOffset(0); setSelected(null); }} disabled={offset === 0}>Today</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setOffset((o) => o + 1); setSelected(null); }} aria-label="Next month">›</Button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d) => <p key={d} className="text-[11px] text-ink-3 pb-1">{d}</p>)}
                {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const key = formatDay(monthStart + i * DAY);
                    const list = byDay.get(key) ?? [];
                    const isToday = monthStart + i * DAY === today;
                    const isSelected = selected === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={list.length === 0}
                            onClick={() => setSelected(isSelected ? null : key)}
                            aria-label={`${key}${list.length ? `: ${list.map((s) => s.name).join(', ')}` : ''}`}
                            aria-pressed={isSelected}
                            className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 border transition-colors ${isSelected ? 'border-accent bg-accent-soft' : isToday ? 'border-line-strong bg-raised' : 'border-transparent'} ${list.length ? 'hover:bg-raised cursor-pointer' : 'text-ink-3 cursor-default'}`}
                        >
                            <span className={`tabular ${isToday ? 'text-accent font-semibold' : list.length ? 'text-ink' : ''}`}>{i + 1}</span>
                            <span className="flex gap-0.5 h-1.5" aria-hidden>
                                {list.slice(0, 3).map((s, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: categoryColor(s.category || 'Other') }} />)}
                            </span>
                        </button>
                    );
                })}
            </div>
            {selected && picked.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-line pt-3">
                    {picked.map((s) => (
                        <li key={s.id} className="flex justify-between text-sm">
                            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: categoryColor(s.category || 'Other') }} aria-hidden />{s.name}</span>
                            <span className="tabular">{formatMajor(s.amount ?? 0, s.currency ?? currency)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
