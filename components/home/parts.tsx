import Link from 'next/link';
import { categoryColor } from '@/lib/chartColors';
import { formatDate, formatInterval, formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import type { Insight } from '@/lib/subscriptions/insights';
import type { Renewal } from '@/lib/subscriptions/schedule';
import type { CategoryShare } from '@/lib/subscriptions/totals';
import { toMajor, type Minor } from '@/types/money';

export interface Kpi {
    label: string;
    value: string;
    note: string;
}

/** Four headline numbers in one ruled strip, aligned to a shared grid. */
export function KpiStrip({ items }: { items: Kpi[] }) {
    return (
        <dl className="grid grid-cols-2 lg:grid-cols-4 border-y border-line">
            {items.map((k, i) => (
                <div key={k.label} className={`py-4 px-1 sm:px-5 first:pl-0 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i > 0 ? 'lg:border-l lg:border-line' : ''} ${i >= 2 ? 'border-t border-line lg:border-t-0' : ''}`}>
                    <dt className="eyebrow">{k.label}</dt>
                    <dd className="font-display text-[2rem] sm:text-4xl leading-none mt-2 tabular truncate">{k.value}</dd>
                    <dd className="text-xs text-ink-3 mt-1.5 truncate">{k.note}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Upcoming charges as aligned columns: date, name, cycle, amount. */
export function UpcomingTable({ renewals, currency, onOpen, limit = 8 }: { renewals: Renewal[]; currency: string; onOpen: (r: Renewal) => void; limit?: number }) {
    if (renewals.length === 0) return <p className="text-sm text-ink-3 py-4">Nothing renews in the next 30 days.</p>;
    return (
        <>
            <div className="hidden sm:grid grid-cols-[64px_minmax(0,1fr)_110px_110px] gap-4 pb-2 border-b border-line eyebrow">
                <span>Date</span><span>Name</span><span>Repeats</span><span className="text-right">Amount</span>
            </div>
            <ul className="divide-y divide-line">
                {renewals.slice(0, limit).map((r) => (
                    <li key={r.sub.id}>
                        <button type="button" onClick={() => onOpen(r)} className="w-[calc(100%+1rem)] grid grid-cols-[64px_minmax(0,1fr)_auto] sm:grid-cols-[64px_minmax(0,1fr)_110px_110px] gap-x-4 items-baseline py-3 text-left hover:bg-raised/50 transition-colors -mx-2 px-2 rounded-lg">
                            <span className="eyebrow !text-ink-2">{formatShortDate(r.date)}</span>
                            <span className="min-w-0">
                                <span className="block truncate">{r.sub.name}</span>
                                <span className="block text-xs text-ink-3">{relativeDays(r.daysUntil)}{r.daysUntil <= 3 ? ' · soon' : ''}</span>
                            </span>
                            <span className="hidden sm:block text-sm text-ink-3">{formatInterval(r.sub.interval_count, r.sub.interval_unit)}</span>
                            <span className="tabular text-right">{formatMajor(r.sub.amount ?? 0, r.sub.currency ?? currency)}</span>
                        </button>
                    </li>
                ))}
            </ul>
            {renewals.length > limit && (
                <Link href="/subscriptions" className="block pt-3 text-sm text-accent hover:text-accent-strong">View all {renewals.length} →</Link>
            )}
        </>
    );
}

/** Where the monthly money goes: one stacked strip plus a ledger, sharing the category colors used everywhere. */
export function CategorySplit({ categories, currency }: { categories: CategoryShare[]; currency: string }) {
    return (
        <div>
            <div className="flex h-2.5 gap-[3px] rounded-full overflow-hidden" role="img" aria-label="Monthly cost by category">
                {categories.map((c) => <div key={c.category} style={{ width: `${c.share * 100}%`, background: categoryColor(c.category) }} />)}
            </div>
            <ul className="mt-4 divide-y divide-line">
                {categories.map((c) => (
                    <li key={c.category} className="flex items-baseline gap-3 py-2.5 text-sm">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0 self-center" style={{ background: categoryColor(c.category) }} aria-hidden />
                        <span className="truncate">{c.category}</span>
                        <span className="text-xs text-ink-3">{c.count}</span>
                        <span className="ml-auto tabular">{formatMajor(toMajor(c.monthlyMinor), currency, { whole: true })}<span className="text-ink-3 text-xs"> /mo</span></span>
                        <span className="tabular text-xs text-ink-3 w-9 text-right">{Math.round(c.share * 100)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Insights as short sentences with a status marker (an icon and text, never color alone). */
export function InsightList({ insights, limit = 5 }: { insights: Insight[]; limit?: number }) {
    return (
        <ul className="space-y-3.5">
            {insights.slice(0, limit).map((i) => (
                <li key={i.id} className="flex gap-3 text-sm leading-relaxed">
                    <span className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-semibold ${i.tone === 'warn' ? 'border-warn/60 text-warn' : 'border-line-strong text-ink-3'}`} aria-label={i.tone === 'warn' ? 'Heads up' : 'Note'}>
                        {i.tone === 'warn' ? '!' : 'i'}
                    </span>
                    <span className="text-ink-2">{i.text}</span>
                </li>
            ))}
        </ul>
    );
}

export const NextCharge = ({ r, currency }: { r: Renewal; currency: string }) => (
    <>{formatMajor(r.sub.amount ?? 0, r.sub.currency ?? currency, { whole: true })} · {formatDate(r.date)}</>
);

export type { Minor };
