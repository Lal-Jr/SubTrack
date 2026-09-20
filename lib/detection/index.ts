import type { Minor } from '@/types/money';
import { dayDiff, formatDay, parseDay } from './dates';
import { analyzeAmounts } from './amounts';
import { analyzeIntervals, chargesPerYear, cycleDays, nextCharge } from './intervals';
import { isExcluded, normalizeMerchant } from './normalize';
import type { DetectedSubscription, DetectionOptions, Status, Transaction } from './types';

export type { DetectedSubscription, DetectionOptions, Frequency, Status, Transaction } from './types';
export type { MerchantRule } from './merchants';
export { toInterval } from './intervals';
export { normalizeMerchant } from './normalize';

interface Charge {
    day: number;
    amount: Minor;
}

interface Group {
    name: string;
    rule: ReturnType<typeof normalizeMerchant>['rule'];
    debits: Charge[];
    credits: Charge[];
}

const REFUND_WINDOW_DAYS = 7;
/** A subscription with no charge for this many cycles is considered lapsed. */
const LAPSE_CYCLES = 2;

/** Removes each debit that was reversed by a credit of the same amount within a week. */
function dropRefunded({ debits, credits }: Group): Charge[] {
    const used = new Set<number>();
    return debits.filter((d) => {
        const i = credits.findIndex(
            (c, idx) => !used.has(idx) && c.amount === d.amount && c.day >= d.day && dayDiff(d.day, c.day) <= REFUND_WINDOW_DAYS,
        );
        if (i === -1) return true;
        used.add(i);
        return false;
    });
}

/** Collapses identical same-day charges, which are almost always a statement listing the row twice. */
function dedupe(charges: Charge[]): Charge[] {
    const seen = new Set<string>();
    return charges.filter((c) => {
        const k = `${c.day}:${c.amount}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function confidence(status: Status, occurrences: number, regularity: number, known: boolean, variable: boolean): number {
    if (status === 'possible') return known ? 0.35 : 0.2;
    let score = status === 'confirmed' ? 0.65 : 0.45;
    if (status === 'confirmed') score += Math.min(0.12, (occurrences - 3) * 0.03);
    score += 0.12 * regularity;
    if (known) score += 0.08;
    if (variable) score -= 0.1;
    return Math.round(Math.max(0.05, Math.min(0.99, score)) * 100) / 100;
}

/**
 * Detects recurring subscriptions in a list of bank transactions.
 *
 * Pipeline: drop unusable and excluded rows -> group by merchant -> cancel refunded debits ->
 * find the billing frequency from the gaps between charges -> check the amounts are stable ->
 * grade the result by how much evidence there is.
 */
export function detectSubscriptions(transactions: Transaction[], options: DetectionOptions = {}): DetectedSubscription[] {
    const asOf = parseDay((options.asOf ?? new Date()).toISOString());
    const groups = new Map<string, Group>();

    for (const t of transactions) {
        const day = parseDay(t.date);
        if (Number.isNaN(day) || t.amountMinor === 0) continue;
        const isDebit = t.amountMinor < 0;
        if (isDebit && isExcluded(t.description)) continue;

        const { key, name, rule } = normalizeMerchant(t.description, options.merchants);
        if (key.length < 2) continue;
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { name, rule, debits: [], credits: [] }));
        (isDebit ? g.debits : g.credits).push({ day, amount: Math.abs(t.amountMinor) });
    }

    const results: DetectedSubscription[] = [];

    for (const [key, group] of groups) {
        const charges = dedupe(dropRefunded(group)).sort((a, b) => a.day - b.day);
        const n = charges.length;
        if (n === 0) continue;

        const known = group.rule?.subscription === true;
        const amounts = analyzeAmounts(charges.map((c) => c.amount));
        // Unknown merchants whose amounts keep moving look like bills, not subscriptions.
        if (amounts.isVariable && !known) continue;

        let status: Status;
        let frequency;
        let regularity = 1;

        if (n === 1) {
            if (!known) continue;
            status = 'possible';
            frequency = group.rule?.frequency ?? 'monthly';
        } else {
            const gaps = charges.slice(1).map((c, i) => dayDiff(charges[i].day, c.day));
            const analysis = analyzeIntervals(gaps);
            if (!analysis) continue;
            // Two charges at different prices from an unknown merchant is not enough evidence.
            if (n === 2 && amounts.priceChanged && !known) continue;
            status = n >= 3 ? 'confirmed' : 'probable';
            frequency = analysis.frequency;
            regularity = analysis.regularity;
        }

        const last = charges[n - 1].day;
        const active = dayDiff(last, asOf) <= cycleDays(frequency) * LAPSE_CYCLES;
        const price = amounts.expectedMinor;

        results.push({
            key,
            merchant: group.name,
            category: group.rule?.category ?? null,
            frequency,
            status,
            occurrences: n,
            amountMinor: price,
            priceHistoryMinor: charges.map((c) => c.amount),
            priceChanged: amounts.priceChanged,
            isVariable: amounts.isVariable,
            firstDate: formatDay(charges[0].day),
            lastDate: formatDay(last),
            nextDate: active ? formatDay(nextCharge(last, frequency)) : null,
            active,
            annualCostMinor: price * chargesPerYear(frequency),
            confidence: confidence(status, n, regularity, known, amounts.isVariable),
        });
    }

    // Active first, then by annual cost.
    return results.sort((a, b) => Number(b.active) - Number(a.active) || b.annualCostMinor - a.annualCostMinor);
}
