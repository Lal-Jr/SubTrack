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
import { dayDiff, formatDay } from '@/lib/detection/dates';
import { formatInterval, formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { nextChargeOnOrAfter, todayUtc } from '@/lib/subscriptions/schedule';
import { monthlyMinor, totals } from '@/lib/subscriptions/totals';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';
import { toMajor } from '@/types/money';

type Filter = 'active' | 'cancelled' | 'all';
type Sort = 'next' | 'cost' | 'name';

interface Row {
    s: SubscriptionRow;
    next: number | null;
}

// One grid template shared by the header and every row keeps every column aligned.
const COLS = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_100px_110px]';

export default function SubscriptionsPage() {
    const { data, loading } = useSubscriptions();
    const { currency } = useProfile();
    const { open: openAdd } = useAddSubscription();
    const [filter, setFilter] = useState<Filter>('active');
    const [sort, setSort] = useState<Sort>('next');
    const [category, setCategory] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<SubscriptionRow | null>(null);

    const today = todayUtc();
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list: Row[] = data
            .filter((s) => (filter === 'all' ? true : filter === 'active' ? isActive(s) : !isActive(s)))
            .filter((s) => !category || (s.category || 'Other') === category)
            .filter((s) => !q || s.name.toLowerCase().includes(q))
            .map((s) => ({ s, next: isActive(s) ? nextChargeOnOrAfter(s, today) : null }));
        return list.sort((a, b) => {
            if (sort === 'name') return a.s.name.localeCompare(b.s.name);
            if (sort === 'cost') return monthlyMinor(b.s) - monthlyMinor(a.s);
            return (a.next ?? Infinity) - (b.next ?? Infinity) || a.s.name.localeCompare(b.s.name);
        });
    }, [data, filter, sort, category, query, today]);

    const t = totals(data, currency);
    const shownMonthly = rows.reduce((a, r) => a + (isActive(r.s) && (r.s.currency ?? currency) === currency ? monthlyMinor(r.s) : 0), 0);

    return (
        <div>
            <PageHeader
                title="Subscriptions"
                description={loading ? undefined : `${t.activeCount} active · ${formatMajor(toMajor(t.monthlyMinor), currency, { whole: true })} a month`}
                action={<Button variant="primary" onClick={openAdd}>Add subscription</Button>}
            />

            <div className="flex flex-wrap items-center gap-3 mb-5">
                <Segmented label="Status" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
                <div className="flex-1 min-w-40"><Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search subscriptions" /></div>
                <div className="w-[calc(50%-6px)] sm:w-44"><Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
                <div className="w-[calc(50%-6px)] sm:w-40"><Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by"><option value="next">Next charge</option><option value="cost">Highest cost</option><option value="name">Name</option></Select></div>
            </div>

            {loading ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : rows.length === 0 ? (
                <EmptyState
                    title={data.length === 0 ? 'Nothing here yet.' : 'Nothing matches.'}
                    body={data.length === 0 ? 'Add one by hand, or import a bank statement to find them automatically.' : 'Try a different filter or search.'}
                    action={data.length === 0 ? <Button variant="primary" onClick={openAdd}>Add subscription</Button> : undefined}
                />
            ) : (
                <div role="table" aria-label="Subscriptions">
                    <div role="row" className={`hidden md:grid ${COLS} gap-4 pb-2 border-b border-line-strong eyebrow`}>
                        <span role="columnheader">Name</span>
                        <span role="columnheader">Category</span>
                        <span role="columnheader">Repeats</span>
                        <span role="columnheader">Next charge</span>
                        <span role="columnheader" className="text-right">Per month</span>
                        <span role="columnheader" className="text-right">Per charge</span>
                    </div>
                    <ul className="divide-y divide-line">
                        {rows.map(({ s, next }) => {
                            const cur = s.currency ?? currency;
                            const active = isActive(s);
                            return (
                                <li key={s.id} role="row">
                                    <button type="button" onClick={() => setEditing(s)} aria-label={`Open ${s.name}`} className={`w-[calc(100%+1rem)] text-left grid grid-cols-[minmax(0,1fr)_auto] ${COLS} gap-x-4 gap-y-1 items-baseline py-3.5 -mx-2 px-2 rounded-lg hover:bg-raised/50 transition-colors ${active ? '' : 'opacity-60'}`}>
                                        <span role="cell" className="min-w-0 flex items-center gap-2">
                                            <span className="truncate text-[15px]">{s.name}</span>
                                            {!active && <Badge>Cancelled</Badge>}
                                            {s.is_variable === 1 && <Badge>Varies</Badge>}
                                        </span>
                                        <span role="cell" className="tabular text-right md:order-last">{formatMajor(s.amount ?? 0, cur)}</span>
                                        <span role="cell" className="hidden md:block"><CategoryTag category={s.category} /></span>
                                        <span role="cell" className="hidden md:block text-sm text-ink-2">{formatInterval(s.interval_count, s.interval_unit)}</span>
                                        <span role="cell" className="hidden md:block text-sm">
                                            {next !== null ? <>{formatShortDate(formatDay(next))} <span className="text-ink-3">· {relativeDays(dayDiff(today, next)).toLowerCase()}</span></> : <span className="text-ink-3">-</span>}
                                        </span>
                                        <span role="cell" className="hidden md:block tabular text-right text-ink-2">{formatMajor(toMajor(monthlyMinor(s)), cur)}</span>
                                        {/* phone: meta line under the name */}
                                        <span role="cell" className="md:hidden col-span-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                                            <CategoryTag category={s.category} />
                                            <span aria-hidden>·</span>
                                            <span>{formatInterval(s.interval_count, s.interval_unit)}</span>
                                            {next !== null && <><span aria-hidden>·</span><span>{formatShortDate(formatDay(next))}, {relativeDays(dayDiff(today, next)).toLowerCase()}</span></>}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    <div className={`hidden md:grid ${COLS} gap-4 pt-3 border-t border-line-strong text-sm`}>
                        <span className="eyebrow col-span-4">{rows.length} shown</span>
                        <span className="tabular text-right">{formatMajor(toMajor(shownMonthly), currency)}</span>
                        <span />
                    </div>
                </div>
            )}

            <EditSheet sub={editing} currency={currency} onClose={() => setEditing(null)} />
        </div>
    );
}
