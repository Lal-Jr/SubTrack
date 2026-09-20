'use client';

import { useMemo, useState } from 'react';
import EditSheet from '@/components/subscriptions/EditSheet';
import { CategoryTag } from '@/components/subscriptions/CategoryDot';
import { useAddSubscription } from '@/components/shell/AddMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Segmented, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { CATEGORIES } from '@/lib/chartColors';
import { dayDiff } from '@/lib/detection/dates';
import { formatInterval, formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { nextChargeOnOrAfter, todayUtc } from '@/lib/subscriptions/schedule';
import { monthlyMinor } from '@/lib/subscriptions/totals';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';
import { formatDay } from '@/lib/detection/dates';
import { toMajor } from '@/types/money';

type Filter = 'active' | 'cancelled' | 'all';

interface Row {
    s: SubscriptionRow;
    next: number | null;
}

const GROUPS = [
    { key: 'week', title: 'Next 7 days' },
    { key: 'month', title: 'Next 30 days' },
    { key: 'later', title: 'Later' },
    { key: 'cancelled', title: 'Cancelled' },
] as const;

export default function SubscriptionsPage() {
    const { data, loading } = useSubscriptions();
    const { currency } = useProfile();
    const { open: openAdd } = useAddSubscription();
    const [filter, setFilter] = useState<Filter>('active');
    const [category, setCategory] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<SubscriptionRow | null>(null);

    const today = todayUtc();
    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows: Row[] = data
            .filter((s) => (filter === 'all' ? true : filter === 'active' ? isActive(s) : !isActive(s)))
            .filter((s) => !category || (s.category || 'Other') === category)
            .filter((s) => !q || s.name.toLowerCase().includes(q))
            .map((s) => ({ s, next: isActive(s) ? nextChargeOnOrAfter(s, today) : null }))
            .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity) || a.s.name.localeCompare(b.s.name));
        const bucket = (r: Row) => {
            if (!isActive(r.s)) return 'cancelled';
            const d = r.next === null ? Infinity : dayDiff(today, r.next);
            return d <= 7 ? 'week' : d <= 30 ? 'month' : 'later';
        };
        return GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => bucket(r) === g.key) })).filter((g) => g.rows.length > 0);
    }, [data, filter, category, query, today]);

    const activeCount = data.filter(isActive).length;

    return (
        <div>
            <PageHeader title="Every subscription" description={loading ? undefined : `${activeCount} active`} />

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Segmented label="Status" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
                <div className="flex-1 min-w-40"><Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search subscriptions" /></div>
                <div className="w-full sm:w-44"><Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
            </div>

            {loading ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : grouped.length === 0 ? (
                <EmptyState
                    title={data.length === 0 ? 'Nothing here yet.' : 'Nothing matches.'}
                    body={data.length === 0 ? 'Add one by hand, or import a bank statement to find them automatically.' : 'Try a different filter or search.'}
                    action={data.length === 0 ? <Button variant="primary" onClick={openAdd}>Add subscription</Button> : undefined}
                />
            ) : (
                <div className="space-y-8">
                    {grouped.map((g) => (
                        <section key={g.key} aria-label={g.title}>
                            <h2 className="eyebrow border-t border-line pt-4 mb-1">{g.title}</h2>
                            <ul>
                                {g.rows.map(({ s, next }) => {
                                    const cur = s.currency ?? currency;
                                    return (
                                        <li key={s.id}>
                                            <button type="button" onClick={() => setEditing(s)} className="w-full text-left py-3.5 group" aria-label={`Open ${s.name}`}>
                                                <div className="flex items-baseline gap-3">
                                                    <span className="eyebrow w-14 shrink-0">{next !== null ? formatShortDate(formatDay(next)) : '—'}</span>
                                                    <span className="truncate text-[17px] group-hover:text-accent transition-colors">{s.name}</span>
                                                    {!isActive(s) && <Badge>Cancelled</Badge>}
                                                    {s.is_variable === 1 && <Badge>Varies</Badge>}
                                                    <span className="leader" aria-hidden />
                                                    <span className="tabular shrink-0">{formatMajor(s.amount ?? 0, cur)}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 pl-[68px] text-xs text-ink-3">
                                                    <CategoryTag category={s.category} />
                                                    <span aria-hidden>·</span>
                                                    <span>{formatInterval(s.interval_count, s.interval_unit)}</span>
                                                    <span aria-hidden>·</span>
                                                    <span className="tabular">{formatMajor(toMajor(monthlyMinor(s)), cur)}/mo</span>
                                                    {next !== null && <span className="hidden sm:contents"><span aria-hidden>·</span><span>{relativeDays(dayDiff(today, next)).toLowerCase()}</span></span>}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            <EditSheet sub={editing} currency={currency} onClose={() => setEditing(null)} />
        </div>
    );
}
