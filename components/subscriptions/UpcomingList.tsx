import Link from 'next/link';
import { formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import type { Renewal } from '@/lib/subscriptions/schedule';
import { Badge } from '@/components/ui/Badge';

export default function UpcomingList({ renewals, fallbackCurrency, limit = 6 }: { renewals: Renewal[]; fallbackCurrency: string; limit?: number }) {
    if (renewals.length === 0) {
        return <p className="px-5 py-8 text-sm text-ink-3 text-center">No renewals in the next 30 days.</p>;
    }
    return (
        <>
            <ul className="divide-y divide-line">
                {renewals.slice(0, limit).map(({ sub, date, daysUntil }) => (
                    <li key={sub.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-11 shrink-0 text-center leading-tight" aria-hidden>
                            <p className="text-[11px] uppercase text-ink-3">{formatShortDate(date).split(' ')[1]}</p>
                            <p className="text-lg font-semibold tabular">{formatShortDate(date).split(' ')[0]}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{sub.name}</p>
                            <p className="text-xs text-ink-3">{relativeDays(daysUntil)}</p>
                        </div>
                        {daysUntil <= 3 && <Badge tone="warn">Soon</Badge>}
                        <p className="tabular text-sm">{formatMajor(sub.amount ?? 0, sub.currency ?? fallbackCurrency)}</p>
                    </li>
                ))}
            </ul>
            {renewals.length > limit && (
                <Link href="/subscriptions" className="block px-5 py-3 text-xs text-accent hover:text-accent-strong border-t border-line">
                    View all {renewals.length} renewals
                </Link>
            )}
        </>
    );
}
