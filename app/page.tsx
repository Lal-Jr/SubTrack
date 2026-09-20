'use client';

import { useMemo, useState } from 'react';
import Billboard from '@/components/netflix/Billboard';
import PosterCard from '@/components/netflix/PosterCard';
import Row from '@/components/netflix/Row';
import CommittedGauge from '@/components/runway/CommittedGauge';
import RunwayTrack, { chargeKey } from '@/components/runway/RunwayTrack';
import { useAddSubscription } from '@/components/shell/AddMenu';
import EditSheet from '@/components/subscriptions/EditSheet';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, Section, Skeleton } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Field';
import { formatDate, formatMajor, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { chargesInWindow, todayUtc, upcomingRenewals } from '@/lib/subscriptions/schedule';
import { monthlyMinor, totals, yearlyMinor } from '@/lib/subscriptions/totals';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';
import { toMajor } from '@/types/money';

type Range = '30' | '90';

export default function HomePage() {
    const subs = useSubscriptions();
    const { profile, currency, loading: profileLoading } = useProfile();
    const { openManual } = useAddSubscription();
    const [range, setRange] = useState<Range>('30');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [editing, setEditing] = useState<SubscriptionRow | null>(null);
    const days = Number(range);
    const loading = subs.loading || profileLoading;
    const today = todayUtc();

    const view = useMemo(() => {
        const mine = subs.data.filter((s) => (s.currency ?? currency) === currency);
        const active = mine.filter(isActive);
        const charges = chargesInWindow(mine, today, days);
        const byCategory = new Map<string, SubscriptionRow[]>();
        for (const s of active) byCategory.set(s.category || 'Other', [...(byCategory.get(s.category || 'Other') ?? []), s]);
        return {
            charges,
            total: charges.reduce((a, c) => a + c.amount, 0),
            t: totals(subs.data, currency),
            next: upcomingRenewals(mine, today, 366)[0] ?? null,
            soon: upcomingRenewals(mine, today, 30),
            top: [...active].sort((a, b) => yearlyMinor(b) - yearlyMinor(a)).slice(0, 5),
            categories: [...byCategory.entries()]
                .map(([name, list]) => ({ name, list: list.sort((a, b) => monthlyMinor(b) - monthlyMinor(a)), monthly: list.reduce((a, s) => a + monthlyMinor(s), 0) }))
                .sort((a, b) => b.monthly - a.monthly),
            cancelled: mine.filter((s) => !isActive(s)),
        };
    }, [subs.data, currency, days, today]);

    const selected = view.charges.find((c) => chargeKey(c) === selectedKey) ?? null;
    const firstName = profile?.name?.split(' ')[0];

    if (loading) {
        return <div className="space-y-6"><Skeleton className="h-[420px] !rounded-3xl" /><Skeleton className="h-40" /></div>;
    }

    if (subs.data.length === 0) {
        return (
            <EmptyState
                title={firstName ? `Nothing on the runway yet, ${firstName}.` : 'Nothing on the runway yet.'}
                body="Import a bank statement and Subtrack will find your recurring payments, or add one by hand."
                action={<div className="flex gap-2 mt-2"><LinkButton href="/import" variant="primary">Import a statement</LinkButton><button onClick={openManual} className="h-11 px-5 rounded-full border border-line-strong text-sm hover:bg-raised">Add manually</button></div>}
            />
        );
    }

    return (
        <div className="space-y-12">
            {view.next && <Billboard renewal={view.next} currency={currency} todayMs={today} onDetails={() => setEditing(view.next!.sub)} />}

            <div className="max-w-3xl space-y-10">
                <div>
                    <p className="eyebrow mb-4">{firstName ? `${firstName}, next ${days} days` : `Next ${days} days`}</p>
                    <h2 className="font-display leading-[0.98] tracking-tight text-[clamp(2.4rem,8vw,4rem)]">
                        <span className="text-accent">{formatMajor(view.total, currency, { whole: true })}</span> leaves your account{' '}
                        <span className="text-ink-2 italic">across {view.charges.length} charge{view.charges.length === 1 ? '' : 's'}.</span>
                    </h2>
                    {view.t.otherCurrencyCount > 0 && (
                        <p className="text-sm text-ink-3 mt-3">{view.t.otherCurrencyCount} subscription{view.t.otherCurrencyCount === 1 ? '' : 's'} in other currencies not counted.</p>
                    )}
                </div>

                <section aria-label="Runway">
                    <div className="flex items-center justify-between mb-2">
                        <span className="eyebrow">Runway</span>
                        <Segmented label="Time window" value={range} onChange={(v) => { setRange(v); setSelectedKey(null); }} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
                    </div>
                    <RunwayTrack charges={view.charges} days={days} currency={currency} selectedKey={selectedKey} onSelect={setSelectedKey} />
                    <div className="min-h-14 mt-1">
                        {selected ? (
                            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{selected.sub.name}</p>
                                    <p className="text-xs text-ink-3">{formatDate(selected.date)} · {relativeDays(selected.daysUntil).toLowerCase()}</p>
                                </div>
                                <p className="font-display text-3xl tabular">{formatMajor(selected.amount, selected.sub.currency ?? currency)}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-ink-3 pt-3">Bigger beads are bigger charges. Tap one for details.</p>
                        )}
                    </div>
                </section>

                {profile?.monthly_income ? (
                    <Section title="Committed">
                        <CommittedGauge monthly={toMajor(view.t.monthlyMinor)} income={profile.monthly_income} currency={currency} />
                    </Section>
                ) : null}
            </div>

            <div className="space-y-10">
                {view.soon.length > 0 && (
                    <Row title="Renewing soon" hint="Next 30 days">
                        {view.soon.map(({ sub }) => <PosterCard key={sub.id} sub={sub} currency={currency} todayMs={today} onOpen={setEditing} />)}
                    </Row>
                )}
                {view.top.length > 1 && (
                    <Row title="Top 5 by cost" hint="Per year">
                        {view.top.map((sub, i) => <PosterCard key={sub.id} sub={sub} currency={currency} todayMs={today} rank={i + 1} onOpen={setEditing} />)}
                    </Row>
                )}
                {view.categories.map((c) => (
                    <Row key={c.name} title={c.name} hint={`${formatMajor(toMajor(c.monthly), currency, { whole: true })} a month`}>
                        {c.list.map((sub) => <PosterCard key={sub.id} sub={sub} currency={currency} todayMs={today} onOpen={setEditing} />)}
                    </Row>
                ))}
                {view.cancelled.length > 0 && (
                    <Row title="Cancelled" hint="Kept for the record">
                        {view.cancelled.map((sub) => <PosterCard key={sub.id} sub={sub} currency={currency} todayMs={today} onOpen={setEditing} />)}
                    </Row>
                )}
            </div>

            <div className="max-w-3xl grid grid-cols-3 border-t border-line pt-4">
                {[
                    ['Per month', formatMajor(toMajor(view.t.monthlyMinor), currency, { whole: true })],
                    ['Per year', formatMajor(toMajor(view.t.yearlyMinor), currency, { whole: true })],
                    ['Active', String(view.t.activeCount)],
                ].map(([label, value]) => (
                    <div key={label}>
                        <p className="eyebrow">{label}</p>
                        <p className="font-display text-3xl sm:text-4xl mt-1 tabular">{value}</p>
                    </div>
                ))}
            </div>

            <EditSheet sub={editing} currency={currency} onClose={() => setEditing(null)} />
        </div>
    );
}
