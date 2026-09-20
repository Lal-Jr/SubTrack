import { addDays, addMonths, dayDiff, formatDay, parseDay } from '@/lib/detection/dates';
import type { SubscriptionRow } from './types';

/** Milliseconds for today's date at UTC midnight, the unit all schedule math uses. */
export const todayUtc = (now = new Date()) => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

/**
 * The nth charge counted from an anchor charge. Always computed from the anchor, never by
 * repeatedly adding, so month-end dates do not drift (Jan 31 -> Feb 28 -> Mar 31, not Mar 28).
 */
export function nthCharge(anchorMs: number, count: number, unit: string, n: number): number {
    const c = Math.max(1, count || 1);
    switch (unit) {
        case 'day': return addDays(anchorMs, n * c);
        case 'week': return addDays(anchorMs, n * c * 7);
        case 'year': return addMonths(anchorMs, n * c * 12);
        default: return addMonths(anchorMs, n * c);
    }
}

/** Charges of one subscription falling in [fromMs, toMs], in date order. */
export function chargesBetween(sub: SubscriptionRow, fromMs: number, toMs: number): number[] {
    const anchor = parseDay(sub.next_charge_date ?? '');
    if (Number.isNaN(anchor)) return [];
    const out: number[] = [];
    const count = sub.interval_count ?? 1;
    const unit = sub.interval_unit ?? 'month';
    // Start early enough to cover a stale anchor in the past; cap iterations for safety.
    let n = anchor < fromMs ? Math.max(0, Math.floor(dayDiff(anchor, fromMs) / approxDays(count, unit)) - 1) : 0;
    for (let guard = 0; guard < 5000; guard++, n++) {
        const d = nthCharge(anchor, count, unit, n);
        if (d > toMs) break;
        if (d >= fromMs) out.push(d);
    }
    return out;
}

function approxDays(count: number, unit: string) {
    const c = Math.max(1, count || 1);
    return unit === 'day' ? c : unit === 'week' ? 7 * c : unit === 'year' ? 365 * c : 30 * c;
}

/** The next charge on or after `todayMs`. Rolls forward from a stale saved date, so nothing shows as overdue. */
export function nextChargeOnOrAfter(sub: SubscriptionRow, todayMs: number): number | null {
    const anchor = parseDay(sub.next_charge_date ?? '');
    if (Number.isNaN(anchor)) return null;
    if (anchor >= todayMs) return anchor;
    return chargesBetween(sub, todayMs, addDays(todayMs, 366 * 2))[0] ?? null;
}

export interface Renewal {
    sub: SubscriptionRow;
    dateMs: number;
    date: string;
    daysUntil: number;
}

/** Active subscriptions renewing within the next `days` days, soonest first. */
export function upcomingRenewals(subs: SubscriptionRow[], todayMs: number, days: number): Renewal[] {
    const out: Renewal[] = [];
    for (const sub of subs) {
        if (sub.active === 0) continue;
        const next = nextChargeOnOrAfter(sub, todayMs);
        if (next === null) continue;
        const daysUntil = dayDiff(todayMs, next);
        if (daysUntil <= days) out.push({ sub, dateMs: next, date: formatDay(next), daysUntil });
    }
    return out.sort((a, b) => a.dateMs - b.dateMs || a.sub.name.localeCompare(b.sub.name));
}

export interface WindowCharge {
    sub: SubscriptionRow;
    date: string;
    dateMs: number;
    daysUntil: number;
    amount: number;
}

/**
 * Every individual charge (a weekly subscription counts each week) landing from today through
 * `days` days ahead, soonest first. Amounts are major units in the subscription's own currency.
 */
export function chargesInWindow(subs: SubscriptionRow[], todayMs: number, days: number): WindowCharge[] {
    const end = addDays(todayMs, days);
    const out: WindowCharge[] = [];
    for (const sub of subs) {
        if (sub.active === 0) continue;
        for (const dateMs of chargesBetween(sub, todayMs, end)) {
            out.push({ sub, date: formatDay(dateMs), dateMs, daysUntil: dayDiff(todayMs, dateMs), amount: sub.amount ?? 0 });
        }
    }
    return out.sort((a, b) => a.dateMs - b.dateMs || a.sub.name.localeCompare(b.sub.name));
}
