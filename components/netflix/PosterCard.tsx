'use client';

import { categoryColor } from '@/lib/chartColors';
import { dayDiff } from '@/lib/detection/dates';
import { formatInterval, formatMajor, relativeDays } from '@/lib/format';
import { cycleProgress, nextChargeOnOrAfter } from '@/lib/subscriptions/schedule';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';

interface Props {
    sub: SubscriptionRow;
    currency: string;
    todayMs: number;
    /** Shows a giant outlined rank numeral beside the card (a "Top 5" row). */
    rank?: number;
    onOpen: (sub: SubscriptionRow) => void;
}

/** The poster art: the category color fades to black, with the subscription's initial as a watermark. */
export const posterBackground = (color: string) =>
    `linear-gradient(165deg, ${color} 0%, color-mix(in srgb, ${color} 32%, #0d0c0a) 55%, #0d0c0a 100%)`;

export default function PosterCard({ sub, currency, todayMs, rank, onOpen }: Props) {
    const active = isActive(sub);
    const color = categoryColor(sub.category || 'Other');
    const next = active ? nextChargeOnOrAfter(sub, todayMs) : null;
    const days = next !== null ? dayDiff(todayMs, next) : null;
    const progress = active ? cycleProgress(sub, todayMs) : null;

    const card = (
        <button
            type="button"
            onClick={() => onOpen(sub)}
            aria-label={`${sub.name}, ${formatMajor(sub.amount ?? 0, sub.currency ?? currency)}${days !== null ? `, ${relativeDays(days).toLowerCase()}` : ', cancelled'}`}
            className={`group relative shrink-0 snap-start w-[132px] sm:w-[160px] aspect-[2/3] rounded-xl overflow-hidden text-left transition-transform duration-300 ease-out hover:scale-[1.07] focus-visible:scale-[1.07] hover:z-10 focus-visible:z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${active ? '' : 'grayscale opacity-60'}`}
            style={{ background: posterBackground(color) }}
        >
            <span aria-hidden className="absolute -right-2 -top-5 font-display text-[8.5rem] leading-none text-white/20 select-none">
                {sub.name.charAt(0).toUpperCase()}
            </span>
            <span className="absolute left-2.5 top-2.5 h-5 px-2 rounded-full bg-black/55 backdrop-blur text-[10px] font-medium text-ink flex items-center">
                {days !== null ? (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`) : 'Cancelled'}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-3 pb-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                <p className="font-display text-[1.65rem] leading-[0.95] break-words line-clamp-2">{sub.name}</p>
                <p className="tabular text-sm mt-1.5">{formatMajor(sub.amount ?? 0, sub.currency ?? currency, { whole: (sub.amount ?? 0) >= 1000 })}</p>
                <p className="text-[10px] text-white/60">{formatInterval(sub.interval_count, sub.interval_unit)}</p>
            </div>
            {progress !== null && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
                    <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
            )}
        </button>
    );

    if (rank === undefined) return card;
    return (
        <div className="relative shrink-0 snap-start flex items-end">
            <span
                aria-hidden
                className="font-display leading-[0.8] select-none text-[9rem] sm:text-[11rem] -mr-3 sm:-mr-4 mb-[-0.4rem] pl-2"
                style={{ color: 'transparent', WebkitTextStroke: '3px var(--color-ink-2)' }}
            >
                {rank}
            </span>
            {card}
        </div>
    );
}
