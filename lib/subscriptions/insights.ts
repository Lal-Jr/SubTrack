import { formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import { toMajor } from '@/types/money';
import { formatDay } from '@/lib/detection/dates';
import { nextChargeOnOrAfter, upcomingRenewals } from './schedule';
import { monthlyMinor, totals, yearlyMinor } from './totals';
import { isActive, type SubscriptionRow } from './types';

export interface Insight {
    id: string;
    /** warn = something worth acting on or planning for; info = context. */
    tone: 'info' | 'warn';
    text: string;
}

/**
 * Plain-language observations computed from the subscription list, most useful first:
 * big lump-sum charges coming, imminent renewals, concentration of spend, category overlap and cost per day.
 */
export function buildInsights(subs: SubscriptionRow[], currency: string, todayMs: number): Insight[] {
    const active = subs.filter((s) => isActive(s) && (s.currency ?? currency) === currency);
    if (active.length === 0) return [];

    const money = (minor: number) => formatMajor(toMajor(minor), currency, { whole: true });
    const t = totals(subs, currency);
    const out: Insight[] = [];

    // Big non-monthly charges are the ones that surprise people.
    for (const s of active) {
        const cycleMonths = s.interval_unit === 'year' ? 12 * (s.interval_count ?? 1) : s.interval_unit === 'month' ? (s.interval_count ?? 1) : 0;
        if (cycleMonths < 3) continue;
        const next = nextChargeOnOrAfter(s, todayMs);
        if (next === null || next - todayMs > 90 * 86_400_000) continue;
        const charge = Math.round((s.amount ?? 0) * 100);
        const pct = Math.round((charge / Math.max(1, t.monthlyMinor)) * 100);
        if (pct >= 25) out.push({ id: `lump-${s.id}`, tone: 'warn', text: `${s.name} bills ${money(charge)} on ${formatShortDate(formatDay(next))}, about ${pct}% of a normal month of subscriptions. Plan for it.` });
    }

    for (const r of upcomingRenewals(active, todayMs, 3).slice(0, 2)) {
        out.push({ id: `soon-${r.sub.id}`, tone: 'info', text: `${r.sub.name} renews ${relativeDays(r.daysUntil).toLowerCase()} (${formatMajor(r.sub.amount ?? 0, currency)}).` });
    }

    const ranked = [...active].sort((a, b) => monthlyMinor(b) - monthlyMinor(a));
    const share = Math.round((monthlyMinor(ranked[0]) / Math.max(1, t.monthlyMinor)) * 100);
    if (active.length >= 3 && share >= 30) out.push({ id: 'top-share', tone: 'info', text: `${ranked[0].name} is ${share}% of your monthly subscription spend.` });

    const byCategory = new Map<string, { n: number; monthly: number }>();
    for (const s of active) {
        const key = s.category || 'Other';
        const e = byCategory.get(key) ?? { n: 0, monthly: 0 };
        e.n++;
        e.monthly += monthlyMinor(s);
        byCategory.set(key, e);
    }
    const crowded = [...byCategory.entries()]
        .filter(([, e]) => e.n >= 2 && e.monthly / Math.max(1, t.monthlyMinor) >= 0.25)
        .sort((a, b) => b[1].monthly - a[1].monthly)[0];
    if (crowded) out.push({ id: 'category', tone: 'info', text: `${crowded[1].n} ${crowded[0]} subscriptions add up to ${money(crowded[1].monthly)} a month. Worth checking for overlap.` });

    out.push({ id: 'daily', tone: 'info', text: `Your subscriptions cost about ${money(Math.round(t.yearlyMinor / 365))} a day, ${money(t.yearlyMinor)} a year.` });
    return out;
}

/** Yearly cost expressed per day, in minor units. */
export const dailyMinor = (s: SubscriptionRow) => Math.round(yearlyMinor(s) / 365);
