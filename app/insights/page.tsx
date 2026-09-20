'use client';

import { useMemo } from 'react';
import BarList from '@/components/charts/BarList';
import ForecastChart from '@/components/charts/ForecastChart';
import RenewalCalendar from '@/components/charts/RenewalCalendar';
import IncomeBar from '@/components/subscriptions/IncomeBar';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { categoryColor } from '@/lib/chartColors';
import { formatMajor } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { todayUtc } from '@/lib/subscriptions/schedule';
import { categoryBreakdown, forecast, totals, yearlyMinor } from '@/lib/subscriptions/totals';
import { isActive } from '@/lib/subscriptions/types';
import { toMajor } from '@/types/money';

export default function InsightsPage() {
    const subs = useSubscriptions();
    const { profile, currency, loading: pl } = useProfile();

    const view = useMemo(() => {
        const active = subs.data.filter((s) => isActive(s) && (s.currency ?? currency) === currency);
        const cancelled = subs.data.filter((s) => !isActive(s) && (s.currency ?? currency) === currency);
        return {
            t: totals(subs.data, currency),
            categories: categoryBreakdown(subs.data, currency),
            top: [...active].sort((a, b) => yearlyMinor(b) - yearlyMinor(a)).slice(0, 8),
            months: forecast(subs.data, todayUtc(), 12, currency),
            savedYearly: cancelled.reduce((a, s) => a + yearlyMinor(s), 0),
            cancelledCount: cancelled.length,
        };
    }, [subs.data, currency]);

    if (subs.loading || pl) {
        return <div><PageHeader title="Insights" /><div className="grid lg:grid-cols-2 gap-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div></div>;
    }
    if (view.t.activeCount === 0) {
        return (
            <div>
                <PageHeader title="Insights" />
                <Card><EmptyState title="Nothing to analyze yet" body="Insights appear once you have active subscriptions." action={<LinkButton href="/import" variant="primary">Import a statement</LinkButton>} /></Card>
            </div>
        );
    }

    return (
        <div>
            <PageHeader title="Insights" description="Where your subscription money goes" />
            <div className="grid lg:grid-cols-2 gap-6">
                <Card className="pb-5">
                    <CardHeader title="By category" description="Monthly cost, share of total" />
                    <div className="px-5 pt-4 space-y-5">
                        <div className="flex h-3 gap-0.5 rounded-full overflow-hidden" role="img" aria-label="Share of monthly cost by category">
                            {view.categories.map((c) => <div key={c.category} style={{ width: `${c.share * 100}%`, background: categoryColor(c.category) }} title={`${c.category}: ${(c.share * 100).toFixed(0)}%`} />)}
                        </div>
                        <BarList
                            currency={currency}
                            unit="/mo"
                            items={view.categories.map((c) => ({ key: c.category, label: c.category, valueMinor: c.monthlyMinor, color: categoryColor(c.category), detail: `${(c.share * 100).toFixed(0)}% · ${c.count}` }))}
                        />
                    </div>
                </Card>

                <Card className="pb-5">
                    <CardHeader title="Biggest subscriptions" description="Yearly cost" />
                    <div className="px-5 pt-4">
                        <BarList
                            currency={currency}
                            unit="/yr"
                            items={view.top.map((s) => ({ key: s.id, label: s.name, valueMinor: yearlyMinor(s), color: categoryColor(s.category || 'Other') }))}
                        />
                    </div>
                </Card>

                <Card className="pb-5 lg:col-span-2">
                    <CardHeader title="Scheduled charges" description="Next 12 months, from your real charge dates" />
                    <div className="px-5 pt-4"><ForecastChart data={view.months} currency={currency} /></div>
                </Card>

                <Card className="p-5">
                    <h2 className="text-sm font-semibold mb-4">Renewal calendar</h2>
                    <RenewalCalendar subs={subs.data} currency={currency} />
                </Card>

                <div className="space-y-6">
                    {profile?.monthly_income ? (
                        <Card className="p-5">
                            <h2 className="text-sm font-semibold mb-3">Share of income</h2>
                            <IncomeBar monthlyMinor={view.t.monthlyMinor} income={profile.monthly_income} currency={currency} />
                        </Card>
                    ) : (
                        <Card className="p-5">
                            <h2 className="text-sm font-semibold mb-1">Share of income</h2>
                            <p className="text-sm text-ink-3 mb-3">Add your monthly income to see what share goes to subscriptions.</p>
                            <LinkButton href="/settings" size="sm">Add income</LinkButton>
                        </Card>
                    )}
                    {view.cancelledCount > 0 && (
                        <Card className="p-5">
                            <h2 className="text-sm font-semibold mb-1">Saved by cancelling</h2>
                            <p className="text-2xl font-semibold tabular text-accent">{formatMajor(toMajor(view.savedYearly), currency, { whole: true })}<span className="text-sm text-ink-3 font-normal"> /yr</span></p>
                            <p className="text-xs text-ink-3 mt-1">From {view.cancelledCount} cancelled subscription{view.cancelledCount === 1 ? '' : 's'}.</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
