'use client';

import { useMemo } from 'react';
import { formatMajor, formatShortDate } from '@/lib/format';
import type { WindowCharge } from '@/lib/subscriptions/schedule';

interface Props {
    charges: WindowCharge[];
    days: number;
    currency: string;
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
}

export const chargeKey = (c: WindowCharge) => `${c.sub.id}:${c.date}`;

const MIN = 10;
const MAX = 34;

/**
 * The runway: time runs left to right from today. Each charge is a bead placed at its date and sized
 * by its amount, so big charges are visible before you read a single number. Names sit above or below
 * the line and are dropped where they would collide; the list under the track is the full text version.
 */
export default function RunwayTrack({ charges, days, currency, selectedKey, onSelect }: Props) {
    const beads = useMemo(() => {
        const max = Math.max(...charges.map((c) => c.amount), 1);
        const out: { c: WindowCharge; x: number; size: number; side: 'up' | 'down'; label: boolean }[] = [];
        let lastUp = -100;
        let lastDown = -100;
        for (const [i, c] of charges.entries()) {
            const x = 3 + (c.daysUntil / days) * 94;
            const size = MIN + (MAX - MIN) * Math.sqrt(c.amount / max);
            // Alternate above/below; drop the label if the previous one on that side is too close.
            const side = i % 2 === 0 ? 'up' : 'down';
            const label = x - (side === 'up' ? lastUp : lastDown) >= 15;
            if (label) {
                if (side === 'up') lastUp = x;
                else lastDown = x;
            }
            out.push({ c, x, size, side, label });
        }
        return out;
    }, [charges, days]);

    const ticks = useMemo(() => {
        const step = days <= 31 ? 7 : 30;
        const out: { x: number; text: string }[] = [];
        for (let d = step; d < days; d += step) out.push({ x: 3 + (d / days) * 94, text: days <= 31 ? `${d / 7}w` : `${d / 30}mo` });
        return out;
    }, [days]);

    return (
        <div
            role="group"
            aria-label={`Timeline of the next ${days} days with ${charges.length} charges`}
            className="relative h-48 select-none"
            onClick={() => onSelect(null)}
        >
            {/* the line */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-line-strong" />
            {ticks.map((t) => (
                <div key={t.text} aria-hidden>
                    <div className="absolute top-1/2 w-px h-2 -translate-y-1/2 bg-line-strong" style={{ left: `${t.x}%` }} />
                    <span className="eyebrow absolute bottom-0 -translate-x-1/2 text-[10px]" style={{ left: `${t.x}%` }}>{t.text}</span>
                </div>
            ))}
            {/* today */}
            <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: '3%' }} aria-hidden>
                <div className="w-px flex-1 bg-accent/50" />
            </div>
            <span className="eyebrow absolute left-[3%] bottom-0 -translate-x-1/2 text-accent">Today</span>

            {beads.map(({ c, x, size, side, label }) => {
                const key = chargeKey(c);
                const selected = key === selectedKey;
                return (
                    <div key={key} className="absolute top-1/2" style={{ left: `${x}%` }}>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSelect(selected ? null : key); }}
                            aria-pressed={selected}
                            aria-label={`${c.sub.name}, ${formatMajor(c.amount, c.sub.currency ?? currency)}, ${formatShortDate(c.date)}`}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110 ${selected ? 'bg-accent outline outline-4 outline-accent/25' : 'bg-ink hover:bg-accent'} ring-2 ring-canvas`}
                            style={{ width: size, height: size }}
                        />
                        {(label || selected) && (
                            <span
                                className={`absolute -translate-x-1/2 whitespace-nowrap text-[11px] leading-tight text-center pointer-events-none ${selected ? 'text-accent' : 'text-ink-2'} ${side === 'up' ? 'bottom-1/2' : 'top-1/2'}`}
                                style={{ [side === 'up' ? 'marginBottom' : 'marginTop']: size / 2 + 6 }}
                            >
                                {c.sub.name.length > 12 ? `${c.sub.name.slice(0, 11)}…` : c.sub.name}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
