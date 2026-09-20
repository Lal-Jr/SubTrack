'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CategorySplit, InsightList, KpiStrip, UpcomingTable } from '@/components/home/parts';
import CommittedGauge from '@/components/runway/CommittedGauge';
import RunwayTrack, { chargeKey } from '@/components/runway/RunwayTrack';
import { useAddSubscription } from '@/components/shell/AddMenu';
import EditSheet from '@/components/subscriptions/EditSheet';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, Section, Skeleton } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Field';
import { clearSampleData, loadSampleData, SAMPLE_SOURCE } from '@/lib/db/sample';
import { formatDate, formatMajor, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { buildInsights } from '@/lib/subscriptions/insights';
import { chargesInWindow, todayUtc, upcomingRenewals } from '@/lib/subscriptions/schedule';
import { categoryBreakdown, totals } from '@/lib/subscriptions/totals';
import { type SubscriptionRow } from '@/lib/subscriptions/types';
import { toMajor } from '@/types/money';

type Range = '30' | '90';

function greeting(hour: number) {
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

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
        const charges = chargesInWindow(mine, today, days);
        const soon = upcomingRenewals(mine, today, 30);
        const t = totals(subs.data, currency);
        return {
            charges,
            windowTotal: charges.reduce((a, c) => a + c.amount, 0),
            soon,
            next: upcomingRenewals(mine, today, 366)[0] ?? null,
            month30: chargesInWindow(mine, today, 30),
            t,
            categories: categoryBreakdown(subs.data, currency),
            insights: buildInsights(subs.data, currency, today),
            sampleCount: subs.data.filter((s) => s.source === SAMPLE_SOURCE).length,
        };
    }, [subs.data, currency, days, today]);

    const selected = view.charges.find((c) => chargeKey(c) === selectedKey) ?? null;
    const firstName = profile?.name?.split(' ')[0];

    if (loading) {
        return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
    }

    if (subs.data.length === 0) {
        return (
            <EmptyState
                title={firstName ? `Nothing tracked yet, ${firstName}.` : 'Nothing tracked yet.'}
                body="Import a bank statement and Subtrack finds your recurring payments, adds up what they cost, and warns you before big charges. Or try it first with sample data."
                action={
                    <div className="flex flex-wrap gap-2 mt-2">
                        <LinkButton href="/import" variant="primary">Import a statement</LinkButton>
                        <Button onClick={() => loadSampleData(todayUtc())}>Try with sample data</Button>
                        <Button variant="ghost" onClick={openManual}>Add manually</Button>
                    </div>
                }
            />
        );
    }

    const month30Total = view.month30.reduce((a, c) => a + c.amount, 0);

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div>
                    <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h1 className="font-display text-4xl sm:text-5xl leading-none mt-2">{greeting(new Date().getHours())}{firstName ? `, ${firstName}` : ''}</h1>
                </div>
                {view.sampleCount > 0 && (
                    <p className="text-xs text-ink-3 flex items-center gap-3 border border-line-strong rounded-full pl-4 pr-1.5 h-9">
                        Viewing sample data
                        <Button size="sm" onClick={() => clearSampleData()}>Remove</Button>
                    </p>
                )}
            </div>

            <KpiStrip
                items={[
                    { label: 'Per month', value: formatMajor(toMajor(view.t.monthlyMinor), currency, { whole: true }), note: `${view.t.activeCount} active subscriptions` },
                    { label: 'Per year', value: formatMajor(toMajor(view.t.yearlyMinor), currency, { whole: true }), note: `${formatMajor(toMajor(Math.round(view.t.yearlyMinor / 365)), currency, { whole: true })} a day` },
                    { label: 'Next 30 days', value: formatMajor(month30Total, currency, { whole: true }), note: `${view.month30.length} charge${view.month30.length === 1 ? '' : 's'} due` },
                    { label: 'Next charge', value: view.next ? formatMajor(view.next.sub.amount ?? 0, view.next.sub.currency ?? currency, { whole: true }) : '-', note: view.next ? `${view.next.sub.name} · ${formatDate(view.next.date)}` : 'Nothing scheduled' },
                ]}
            />
            {view.t.otherCurrencyCount > 0 && (
                <p className="text-xs text-ink-3 mt-2">{view.t.otherCurrencyCount} subscription{view.t.otherCurrencyCount === 1 ? '' : 's'} in other currencies are not counted.</p>
            )}

            <div className="mt-10 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-x-12 gap-y-10">
                {/* On phones the insights come first; on desktop they sit in the right column. */}
                <Section title="Worth a look" className="lg:col-start-2 lg:row-start-1">
                    <InsightList insights={view.insights} />
                </Section>

                <Section
                    title="Runway"
                    className="lg:col-start-1 lg:row-start-1"
                    action={<Segmented label="Time window" value={range} onChange={(v) => { setRange(v); setSelectedKey(null); }} options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />}
                >
                    <p className="font-display text-3xl sm:text-4xl leading-tight -mt-1 mb-2">
                        <span className="text-accent">{formatMajor(view.windowTotal, currency, { whole: true })}</span> across {view.charges.length} charge{view.charges.length === 1 ? '' : 's'}
                        <span className="text-ink-3 italic"> in {days} days</span>
                    </p>
                    <RunwayTrack charges={view.charges} days={days} currency={currency} selectedKey={selectedKey} onSelect={setSelectedKey} />
                    <div className="min-h-12">
                        {selected ? (
                            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{selected.sub.name}</p>
                                    <p className="text-xs text-ink-3">{formatDate(selected.date)} · {relativeDays(selected.daysUntil).toLowerCase()}</p>
                                </div>
                                <p className="font-display text-2xl tabular">{formatMajor(selected.amount, selected.sub.currency ?? currency)}</p>
                            </div>
                        ) : (
                            <p className="text-xs text-ink-3 pt-3">Bigger beads are bigger charges. Tap one for details.</p>
                        )}
                    </div>
                </Section>

                <Section title="Upcoming" hint="Next 30 days" className="lg:col-start-1 lg:row-start-2">
                    <UpcomingTable renewals={view.soon} currency={currency} onOpen={(r) => setEditing(r.sub)} />
                </Section>

                <Section title="Where it goes" hint="Monthly" className="lg:col-start-2 lg:row-start-2">
                    <CategorySplit categories={view.categories} currency={currency} />
                    <div className="mt-6 pt-4 border-t border-line">
                        {profile?.monthly_income ? (
                            <CommittedGauge monthly={toMajor(view.t.monthlyMinor)} income={profile.monthly_income} currency={currency} />
                        ) : (
                            <p className="text-sm text-ink-3">
                                Add your monthly income in <Link href="/settings" className="text-accent hover:text-accent-strong">Settings</Link> to see what share of it is committed.
                            </p>
                        )}
                    </div>
                </Section>
            </div>

            <EditSheet sub={editing} currency={currency} onClose={() => setEditing(null)} />
        </div>
    );
}
