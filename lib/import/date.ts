import type { DateOrder } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | null {
    if (y < 100) y += 2000;
    const ms = Date.UTC(y, m - 1, d);
    const dt = new Date(ms);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
}

const monthIndex = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

/**
 * Parses a statement date into YYYY-MM-DD, or null. Numeric day/month dates like 03/04/2025
 * are ambiguous, so `order` says which comes first. Named months and ISO dates are unambiguous.
 */
export function parseDate(raw: string | null | undefined, order: DateOrder = 'dmy'): string | null {
    if (!raw) return null;
    const s = raw.trim();
    let m: RegExpExecArray | null;

    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-/. ]([A-Za-z]{3,9})\.?[-/. ,]*(\d{2,4})(?!\d)/.exec(s))) {
        const mon = monthIndex(m[2]);
        return mon ? iso(+m[3], mon, +m[1]) : null;
    }
    if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})(?!\d)/.exec(s))) {
        const mon = monthIndex(m[1]);
        return mon ? iso(+m[3], mon, +m[2]) : null;
    }
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/.exec(s))) {
        const [a, b] = [+m[1], +m[2]];
        return order === 'dmy' ? iso(+m[3], b, a) : iso(+m[3], a, b);
    }
    return null;
}

/**
 * Works out whether a column of numeric dates is day-first or month-first by looking for a value
 * that can only be one of them (e.g. 25/03 must be day-first). `ambiguous` is true when every
 * sample could be read either way, in which case the caller should let the user confirm.
 */
export function detectDateOrder(samples: string[]): { order: DateOrder; ambiguous: boolean } {
    let dayFirst = false;
    let monthFirst = false;
    let numeric = 0;
    for (const raw of samples) {
        const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/.exec(raw.trim());
        if (!m) continue;
        numeric++;
        if (+m[1] > 12) dayFirst = true;
        if (+m[2] > 12) monthFirst = true;
    }
    if (dayFirst && !monthFirst) return { order: 'dmy', ambiguous: false };
    if (monthFirst && !dayFirst) return { order: 'mdy', ambiguous: false };
    return { order: 'dmy', ambiguous: numeric > 0 && !dayFirst && !monthFirst };
}
