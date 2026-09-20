import { parseDay } from '@/lib/detection/dates';

export function formatMajor(amount: number, currency: string, opts: { whole?: boolean } = {}): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: opts.whole ? 0 : 2,
        minimumFractionDigits: opts.whole ? 0 : undefined,
    }).format(amount);
}

export function formatDate(iso: string | null | undefined): string {
    const ms = parseDay(iso ?? '');
    if (Number.isNaN(ms)) return '-';
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatShortDate(iso: string): string {
    return new Date(parseDay(iso)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function relativeDays(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

const UNIT_LABEL: Record<string, [string, string]> = {
    day: ['Daily', 'days'], week: ['Weekly', 'weeks'], month: ['Monthly', 'months'], year: ['Yearly', 'years'],
};

export function formatInterval(count: number | null, unit: string | null): string {
    const [single, plural] = UNIT_LABEL[unit ?? 'month'] ?? UNIT_LABEL.month;
    return !count || count === 1 ? single : `Every ${count} ${plural}`;
}
