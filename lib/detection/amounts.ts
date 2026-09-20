import type { Minor } from '@/types/money';

export interface AmountAnalysis {
    /** The amount the next charge is expected to be. */
    expectedMinor: Minor;
    /** A single step change in price (e.g. 219 -> 749) as opposed to noise. */
    priceChanged: boolean;
    /** The amount keeps moving (e.g. a utility bill) rather than sitting at one or two price levels. */
    isVariable: boolean;
}

const SAME_LEVEL = 0.05;

/** Splits a series into runs where consecutive amounts are within 5% of each other. */
function levels(amounts: Minor[]): Minor[][] {
    const runs: Minor[][] = [];
    for (const a of amounts) {
        const run = runs[runs.length - 1];
        const prev = run?.[run.length - 1];
        if (run && Math.abs(a - prev) <= prev * SAME_LEVEL) run.push(a);
        else runs.push([a]);
    }
    return runs;
}

const average = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

/** Amounts are positive magnitudes in minor units, in chronological order. */
export function analyzeAmounts(amounts: Minor[]): AmountAnalysis {
    const runs = levels(amounts);
    if (runs.length === 1) return { expectedMinor: amounts[amounts.length - 1], priceChanged: false, isVariable: false };
    if (runs.length === 2) return { expectedMinor: amounts[amounts.length - 1], priceChanged: true, isVariable: false };
    return { expectedMinor: average(amounts.slice(-3)), priceChanged: false, isVariable: true };
}
