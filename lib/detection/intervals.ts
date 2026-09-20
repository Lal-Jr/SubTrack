import { addDays, addMonths } from './dates';
import type { Frequency } from './types';

interface Bucket {
    frequency: Frequency;
    min: number;
    max: number;
    /** Nominal cycle length in days, used to judge whether a subscription has lapsed. */
    days: number;
    perYear: number;
}

const BUCKETS: Bucket[] = [
    { frequency: 'weekly', min: 6, max: 8, days: 7, perYear: 52 },
    { frequency: 'biweekly', min: 13, max: 15, days: 14, perYear: 26 },
    { frequency: 'monthly', min: 27, max: 34, days: 30, perYear: 12 },
    { frequency: 'quarterly', min: 84, max: 98, days: 91, perYear: 4 },
    { frequency: 'yearly', min: 350, max: 380, days: 365, perYear: 1 },
];

export const bucketFor = (days: number): Frequency | null => BUCKETS.find((b) => days >= b.min && days <= b.max)?.frequency ?? null;
const info = (f: Frequency) => BUCKETS.find((b) => b.frequency === f)!;
export const cycleDays = (f: Frequency) => info(f).days;
export const chargesPerYear = (f: Frequency) => info(f).perYear;

export interface IntervalAnalysis {
    frequency: Frequency;
    /** Share of gaps between charges that fit the frequency, 0..1. */
    regularity: number;
}

/** Finds the billing frequency that most gaps between charges agree on, or null if there is none. */
export function analyzeIntervals(gaps: number[]): IntervalAnalysis | null {
    if (gaps.length === 0) return null;
    const counts = new Map<Frequency, number>();
    for (const g of gaps) {
        const b = bucketFor(g);
        if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    let best: Frequency | null = null;
    for (const [f, c] of counts) if (!best || c > counts.get(best)!) best = f;
    if (!best) return null;
    const regularity = counts.get(best)! / gaps.length;
    // With 2+ gaps at least 60% must agree; a single gap must simply fit a bucket.
    return regularity >= 0.6 ? { frequency: best, regularity } : null;
}

/** The date one billing cycle after `fromMs`. */
export function nextCharge(fromMs: number, f: Frequency): number {
    switch (f) {
        case 'weekly': return addDays(fromMs, 7);
        case 'biweekly': return addDays(fromMs, 14);
        case 'monthly': return addMonths(fromMs, 1);
        case 'quarterly': return addMonths(fromMs, 3);
        case 'yearly': return addMonths(fromMs, 12);
    }
}

/** Maps a frequency to the interval_count/interval_unit pair the subscriptions table uses. */
export function toInterval(f: Frequency): { count: number; unit: 'week' | 'month' | 'year' } {
    switch (f) {
        case 'weekly': return { count: 1, unit: 'week' };
        case 'biweekly': return { count: 2, unit: 'week' };
        case 'monthly': return { count: 1, unit: 'month' };
        case 'quarterly': return { count: 3, unit: 'month' };
        case 'yearly': return { count: 1, unit: 'year' };
    }
}
