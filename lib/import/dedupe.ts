import type { ParsedTransaction } from './types';

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * One stable key per transaction, so importing the same or an overlapping statement twice does not
 * duplicate rows. Genuinely identical rows on the same day (two coffees) get an occurrence
 * suffix, so they are kept as two rows and still line up on re-import.
 */
export function dedupeKeys(transactions: ParsedTransaction[]): string[] {
    const seen = new Map<string, number>();
    return transactions.map((t) => {
        const base = `${t.date}|${t.amountMinor}|${squash(t.description)}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return `${base}#${n}`;
    });
}
