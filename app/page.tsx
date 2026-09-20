'use client';

import { useMemo } from 'react';
import ForecastChart from '@/components/charts/ForecastChart';
import IncomeBar from '@/components/subscriptions/IncomeBar';
import UpcomingList from '@/components/subscriptions/UpcomingList';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { formatDate, formatMajor } from '@/lib/format';
import { todayUtc, upcomingRenewals } from '@/lib/subscriptions/schedule';
import { forecast, totals } from '@/lib/subscriptions/totals';
import { toMajor } from '@/types/money';

function greeting(hour: number) {
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card className="p-5">
            <p className="text-xs font-medium text-ink-3">{label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-2 tabular">{value}</p>
            {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
        </Card>
    );
}

export default function OverviewPage() {
    const subs = useSubscriptions();
    const { profile, currency, loading: profileLoading } = useProfile();
    const loading = subs.loading || profileLoading;

    const view = useMemo(() => {
        const today = todayUtc();
        const t = totals(subs.data, currency);
        const renewals = upcomingRenewals(subs.data, today, 30);
        return { t, renewals, months: forecast(subs.data, today, 6, currency), next: renewals[0] };
    }, [subs.data, currency]);

    const firstName = profile?.name?.split(' ')[0];
    const hasAny = subs.data.length > 0;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    {greeting(new Date().getHours())}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="text-sm text-ink-3 mt-1">Here is what your subscriptions cost.</p>
            </header>

            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
                </div>
            ) : !hasAny ? (
                <Card>
                    <EmptyState
                        title="No subscriptions yet"
                        body="Import a bank statement and we will find your recurring payments, or add one by hand."
                        action={
                            <div className="flex gap-2 mt-1">
                                <LinkButton href="/import" variant="primary">Import a statement</LinkButton>
                                <LinkButton href="/subscriptions">Add manually</LinkButton>
                            </div>
                        }
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatTile label="Per month" value={formatMajor(toMajor(view.t.monthlyMinor), currency, { whole: true })} sub="All active subscriptions" />
                        <StatTile label="Per year" value={formatMajor(toMajor(view.t.yearlyMinor), currency, { whole: true })} sub="Projected" />
                        <StatTile label="Active" value={String(view.t.activeCount)} sub={view.t.otherCurrencyCount ? `${view.t.otherCurrencyCount} in other currencies not counted` : 'Subscriptions'} />
                        <StatTile label="Next charge" value={view.next ? formatMajor(view.next.sub.amount ?? 0, view.next.sub.currency ?? currency, { whole: true }) : '-'} sub={view.next ? `${view.next.sub.name} · ${formatDate(view.next.date)}` : 'Nothing scheduled'} />
                    </div>

                    <div className="grid lg:grid-cols-5 gap-6">
                        <Card className="lg:col-span-3 pb-5">
                            <CardHeader title="Scheduled charges" description="Next 6 months, from your real charge dates" />
                            <div className="px-5 pt-4"><ForecastChart data={view.months} currency={currency} /></div>
                        </Card>
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader title="Upcoming renewals" description="Next 30 days" />
                                <div className="mt-2"><UpcomingList renewals={view.renewals} fallbackCurrency={currency} /></div>
                            </Card>
                            {profile?.monthly_income ? (
                                <Card className="p-5">
                                    <h2 className="text-sm font-semibold mb-3">Share of income</h2>
                                    <IncomeBar monthlyMinor={view.t.monthlyMinor} income={profile.monthly_income} currency={currency} />
                                </Card>
                            ) : null}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
