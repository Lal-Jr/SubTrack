import { toMinor, type Minor } from '@/types/money';
import { chargesBetween } from './schedule';
import { isActive, type SubscriptionRow } from './types';
import { addMonths, formatDay } from '@/lib/detection/dates';

export function chargesPerYear(count: number | null, unit: string | null): number {
    const c = Math.max(1, count ?? 1);
    switch (unit) {
        case 'day': return 365 / c;
        case 'week': return 52 / c;
        case 'year': return 1 / c;
        default: return 12 / c;
    }
}

/** Yearly cost of one subscription, in minor units. */
export const yearlyMinor = (s: SubscriptionRow): Minor => Math.round(toMinor(s.amount ?? 0) * chargesPerYear(s.interval_count, s.interval_unit));
export const monthlyMinor = (s: SubscriptionRow): Minor => Math.round(yearlyMinor(s) / 12);

const inCurrency = (s: SubscriptionRow, currency: string) => (s.currency ?? currency) === currency;

export interface Totals {
    activeCount: number;
    monthlyMinor: Minor;
    yearlyMinor: Minor;
    /** Active subscriptions in another currency; they are not converted, so they are left out of the sums. */
    otherCurrencyCount: number;
}

export function totals(subs: SubscriptionRow[], currency: string): Totals {
    let monthly = 0;
    let yearly = 0;
    let count = 0;
    let other = 0;
    for (const s of subs.filter(isActive)) {
        if (!inCurrency(s, currency)) { other++; continue; }
        count++;
        yearly += yearlyMinor(s);
        monthly += monthlyMinor(s);
    }
    return { activeCount: count, monthlyMinor: monthly, yearlyMinor: yearly, otherCurrencyCount: other };
}

export interface CategoryShare {
    category: string;
    monthlyMinor: Minor;
    share: number;
    count: number;
}

export function categoryBreakdown(subs: SubscriptionRow[], currency: string): CategoryShare[] {
    const map = new Map<string, { m: Minor; n: number }>();
    for (const s of subs.filter((x) => isActive(x) && inCurrency(x, currency))) {
        const key = s.category || 'Other';
        const e = map.get(key) ?? { m: 0, n: 0 };
        e.m += monthlyMinor(s);
        e.n++;
        map.set(key, e);
    }
    const total = [...map.values()].reduce((a, e) => a + e.m, 0) || 1;
    return [...map.entries()]
        .map(([category, e]) => ({ category, monthlyMinor: e.m, share: e.m / total, count: e.n }))
        .sort((a, b) => b.monthlyMinor - a.monthlyMinor);
}

export interface MonthForecast {
    /** YYYY-MM */
    month: string;
    totalMinor: Minor;
    /** True for the current month: only charges from today onward are counted. */
    partial: boolean;
    charges: { name: string; date: string; amountMinor: Minor }[];
}

/** Scheduled charges per calendar month for the next `months` months, from real charge dates. */
export function forecast(subs: SubscriptionRow[], todayMs: number, months: number, currency: string): MonthForecast[] {
    const start = new Date(todayMs);
    const monthStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    const active = subs.filter((s) => isActive(s) && inCurrency(s, currency));
    const out: MonthForecast[] = [];
    for (let i = 0; i < months; i++) {
        const from = addMonths(monthStart, i);
        const to = addMonths(monthStart, i + 1) - 86_400_000;
        const charges = active.flatMap((s) =>
            chargesBetween(s, Math.max(from, todayMs), to).map((d) => ({ name: s.name, date: formatDay(d), amountMinor: toMinor(s.amount ?? 0) })),
        );
        out.push({
            month: formatDay(from).slice(0, 7),
            totalMinor: charges.reduce((a, c) => a + c.amountMinor, 0),
            partial: i === 0,
            charges: charges.sort((a, b) => a.date.localeCompare(b.date)),
        });
    }
    return out;
}
