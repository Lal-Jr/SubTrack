// All date math is done on UTC midnight timestamps so results never depend on the viewer's timezone or DST.
const DAY_MS = 86_400_000;

/** Parses the date part of an ISO string to UTC-midnight ms, or NaN when invalid. */
export function parseDay(iso: string): number {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return NaN;
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    // Reject overflow such as 2025-02-31.
    return new Date(ms).getUTCDate() === +m[3] ? ms : NaN;
}

export const formatDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const dayDiff = (fromMs: number, toMs: number) => Math.round((toMs - fromMs) / DAY_MS);
export const addDays = (ms: number, n: number) => ms + n * DAY_MS;

/** Adds calendar months, clamping to month end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(ms: number, n: number): number {
    const d = new Date(ms);
    const day = d.getUTCDate();
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}
