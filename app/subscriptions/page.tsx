'use client';

import { useMemo, useState } from 'react';
import SubscriptionForm from '@/components/subscriptions/SubscriptionForm';
import { CategoryTag } from '@/components/subscriptions/CategoryDot';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, Skeleton } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Segmented, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { CATEGORIES } from '@/lib/chartColors';
import { formatDate, formatInterval, formatMajor, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { dayDiff } from '@/lib/detection/dates';
import { nextChargeOnOrAfter, todayUtc } from '@/lib/subscriptions/schedule';
import { deleteSubscription, setActive } from '@/lib/subscriptions/store';
import { monthlyMinor } from '@/lib/subscriptions/totals';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';
import { toMajor } from '@/types/money';

type Filter = 'active' | 'cancelled' | 'all';
type Sort = 'next' | 'cost' | 'name';

export default function SubscriptionsPage() {
    const { data, loading } = useSubscriptions();
    const { currency } = useProfile();
    const [filter, setFilter] = useState<Filter>('active');
    const [sort, setSort] = useState<Sort>('next');
    const [category, setCategory] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<SubscriptionRow | 'new' | null>(null);
    const [deleting, setDeleting] = useState<SubscriptionRow | null>(null);

    const today = todayUtc();
    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return data
            .filter((s) => (filter === 'all' ? true : filter === 'active' ? isActive(s) : !isActive(s)))
            .filter((s) => !category || (s.category || 'Other') === category)
            .filter((s) => !q || s.name.toLowerCase().includes(q))
            .map((s) => ({ s, next: isActive(s) ? nextChargeOnOrAfter(s, today) : null }))
            .sort((a, b) => {
                if (sort === 'name') return a.s.name.localeCompare(b.s.name);
                if (sort === 'cost') return monthlyMinor(b.s) - monthlyMinor(a.s);
                return (a.next ?? Infinity) - (b.next ?? Infinity) || a.s.name.localeCompare(b.s.name);
            });
    }, [data, filter, sort, category, query, today]);

    const close = () => setEditing(null);

    return (
        <div>
            <PageHeader
                title="Subscriptions"
                description={loading ? undefined : `${data.filter(isActive).length} active`}
                action={<Button variant="primary" onClick={() => setEditing('new')}>Add subscription</Button>}
            />

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <Segmented
                    label="Status"
                    value={filter}
                    onChange={setFilter}
                    options={[{ value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]}
                />
                <div className="w-full sm:w-56"><Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search subscriptions" /></div>
                <div className="w-40"><Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
                <div className="w-44 sm:ml-auto">
                    <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
                        <option value="next">Next charge</option>
                        <option value="cost">Highest cost</option>
                        <option value="name">Name</option>
                    </Select>
                </div>
            </div>

            <Card className="overflow-hidden">
                {loading ? (
                    <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : rows.length === 0 ? (
                    <EmptyState
                        title={data.length === 0 ? 'No subscriptions yet' : 'Nothing matches'}
                        body={data.length === 0 ? 'Add one by hand, or import a bank statement to find them automatically.' : 'Try a different filter or search.'}
                        action={data.length === 0 ? <Button variant="primary" onClick={() => setEditing('new')}>Add subscription</Button> : undefined}
                    />
                ) : (
                    <ul className="divide-y divide-line">
                        {rows.map(({ s, next }) => {
                            const cur = s.currency ?? currency;
                            const active = isActive(s);
                            return (
                                <li key={s.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-raised/40">
                                    <div className="min-w-0 flex-1 basis-40">
                                        <p className="font-medium truncate flex items-center gap-2">
                                            {s.name}
                                            {!active && <Badge>Cancelled</Badge>}
                                            {s.is_variable === 1 && <Badge>Varies</Badge>}
                                        </p>
                                        <p className="flex items-center gap-2 mt-0.5 text-xs text-ink-3">
                                            <CategoryTag category={s.category} />
                                            <span aria-hidden>·</span>
                                            {formatInterval(s.interval_count, s.interval_unit)}
                                        </p>
                                    </div>
                                    <div className="text-right sm:w-36 tabular">
                                        <p className="font-medium">{formatMajor(s.amount ?? 0, cur)}</p>
                                        <p className="text-xs text-ink-3">{formatMajor(toMajor(monthlyMinor(s)), cur)}/mo</p>
                                    </div>
                                    <div className="text-right sm:w-36 text-sm">
                                        {next !== null ? (
                                            <>
                                                <p className="tabular">{formatDate(new Date(next).toISOString())}</p>
                                                <p className="text-xs text-ink-3">{relativeDays(dayDiff(today, next))}</p>
                                            </>
                                        ) : <p className="text-ink-3">-</p>}
                                    </div>
                                    <div className="flex gap-1 ml-auto">
                                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setActive(s.id, !active)} aria-label={`${active ? 'Mark cancelled' : 'Resume'} ${s.name}`}>
                                            {active ? 'Cancel' : 'Resume'}
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <Dialog open={editing !== null} onClose={close} title={editing === 'new' ? 'Add subscription' : 'Edit subscription'}>
                {editing !== null && (
                    <SubscriptionForm
                        existing={editing === 'new' ? undefined : editing}
                        defaultCurrency={currency}
                        onDone={close}
                        onDelete={editing === 'new' ? undefined : () => { setDeleting(editing); close(); }}
                    />
                )}
            </Dialog>

            <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete subscription?" width="max-w-sm">
                <p className="text-sm text-ink-2">
                    <span className="text-ink font-medium">{deleting?.name}</span> will be removed permanently. If you only stopped paying for it, mark it as cancelled instead to keep the history.
                </p>
                <div className="flex justify-end gap-2 mt-5">
                    <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
                    <Button variant="danger" onClick={async () => { if (deleting) await deleteSubscription(deleting.id); setDeleting(null); }}>Delete</Button>
                </div>
            </Dialog>
        </div>
    );
}
