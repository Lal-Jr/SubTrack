'use client';

import { categoryColor } from '@/lib/chartColors';
import { formatDate, formatInterval, formatMajor, relativeDays } from '@/lib/format';
import type { Renewal } from '@/lib/subscriptions/schedule';
import { cycleProgress } from '@/lib/subscriptions/schedule';
import { Button } from '@/components/ui/Button';

/** The hero: your very next charge, staged like a featured title. */
export default function Billboard({ renewal, currency, todayMs, onDetails }: { renewal: Renewal; currency: string; todayMs: number; onDetails: () => void }) {
    const { sub, date, daysUntil } = renewal;
    const color = categoryColor(sub.category || 'Other');
    const progress = cycleProgress(sub, todayMs) ?? 0;
    const cur = sub.currency ?? currency;

    return (
        <section
            aria-label="Next charge"
            className="relative overflow-hidden rounded-3xl min-h-[380px] sm:min-h-[460px] flex items-end"
            style={{
                background: `radial-gradient(90% 100% at 88% 0%, color-mix(in srgb, ${color} 75%, transparent) 0%, transparent 60%), radial-gradient(70% 70% at 0% 100%, rgb(31 224 160 / 0.16) 0%, transparent 65%), linear-gradient(180deg, #1a1813 0%, #0d0c0a 100%)`,
            }}
        >
            <span aria-hidden className="absolute -right-6 -top-16 font-display text-[22rem] sm:text-[30rem] leading-none text-white/10 select-none">
                {sub.name.charAt(0).toUpperCase()}
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" aria-hidden />

            <div className="relative p-6 sm:p-10 max-w-2xl">
                <p className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-black/40 backdrop-blur border border-white/10 eyebrow !text-ink">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden /> Next up · {relativeDays(daysUntil)}
                </p>
                <h1 className="font-display text-[clamp(3.4rem,13vw,7.5rem)] leading-[0.88] tracking-tight mt-4 break-words">{sub.name}</h1>
                <p className="mt-4 text-base sm:text-lg text-ink-2">
                    <span className="text-ink tabular">{formatMajor(sub.amount ?? 0, cur)}</span> · {formatInterval(sub.interval_count, sub.interval_unit).toLowerCase()} · renews {formatDate(date)}
                </p>
                <div className="mt-5 flex items-center gap-3 max-w-sm" aria-label={`${Math.round(progress * 100)}% of the billing cycle has passed`}>
                    <div className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                    <span className="eyebrow !text-ink-2 shrink-0">{Math.round(progress * 100)}% of cycle</span>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Button variant="primary" onClick={onDetails}>
                        <span aria-hidden>▶</span> Details
                    </Button>
                    <Button className="!bg-white/15 !border-transparent hover:!bg-white/25 backdrop-blur" onClick={onDetails}>Edit or cancel</Button>
                </div>
            </div>
        </section>
    );
}
