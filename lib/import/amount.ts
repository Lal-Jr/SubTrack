import type { Minor } from '@/types/money';

/**
 * Parses a money string into minor units, or null if it is not an amount.
 * The sign follows the statement: "(199.00)", "-199.00" and "199.00 Dr" are negative;
 * "199.00 Cr" is positive; a bare "199.00" is positive.
 *
 * Handles currency marks (Rs., INR, $, EUR...), thousands separators in both
 * 1,234.56 and 1.234,56 style (Indian lakh grouping included), and trailing minus.
 */
export function parseAmount(raw: string | null | undefined): Minor | null {
    if (raw == null) return null;
    let s = raw.trim();
    if (!s) return null;

    let negative = false;
    let credit = false;

    const suffix = /\s*(cr|dr)\.?$/i.exec(s);
    if (suffix) {
        if (suffix[1].toLowerCase() === 'dr') negative = true;
        else credit = true;
        s = s.slice(0, suffix.index).trim();
    }
    if (/^\(.*\)$/.test(s)) {
        negative = true;
        s = s.slice(1, -1).trim();
    }
    if (/^[-−]/.test(s)) {
        negative = true;
        s = s.slice(1).trim();
    } else if (s.startsWith('+')) {
        s = s.slice(1).trim();
    }
    if (s.endsWith('-')) {
        negative = true;
        s = s.slice(0, -1).trim();
    }
    s = s.replace(/^(rs\.?|inr|usd|eur|gbp|[₹$€£])\s*/i, '').replace(/\s*(inr|usd|eur|gbp)$/i, '').trim();

    if (!/^\d[\d,.\s']*$|^[.,]\d+$/.test(s)) return null;
    s = s.replace(/[\s']/g, '');

    // The last separator is the decimal point unless exactly three digits follow it (thousands).
    const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    let intPart = s;
    let frac = '';
    if (last !== -1) {
        const after = s.slice(last + 1);
        if (after.length !== 3) {
            intPart = s.slice(0, last);
            frac = after;
        }
    }
    intPart = intPart.replace(/[.,]/g, '') || '0';
    if (!/^\d+$/.test(intPart) || (frac && !/^\d+$/.test(frac))) return null;

    const minor = Number(intPart) * 100 + Number((frac + '00').slice(0, 2));
    if (!Number.isSafeInteger(minor)) return null;
    const value = negative && !credit ? -minor : minor;
    return value === 0 ? 0 : value; // avoid -0
}
