'use client';

import { useMemo } from 'react';
import BarList from '@/components/charts/BarList';
import ForecastChart from '@/components/charts/ForecastChart';
import RenewalCalendar from '@/components/charts/RenewalCalendar';
import CommittedGauge from '@/components/runway/CommittedGauge';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, Section, Skeleton } from '@/components/ui/Card';
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
        const inCur = (s: { currency: string | null }) => (s.currency ?? currency) === currency;
        const active = subs.data.filter((s) => isActive(s) && inCur(s));
        const cancelled = subs.data.filter((s) => !isActive(s) && inCur(s));
        const ranked = [...active].sort((a, b) => yearlyMinor(b) - yearlyMinor(a));
        return {
            t: totals(subs.data, currency),
            categories: categoryBreakdown(subs.data, currency),
            ranked,
            months: forecast(subs.data, todayUtc(), 12, currency),
            savedYearly: cancelled.reduce((a, s) => a + yearlyMinor(s), 0),
            cancelledCount: cancelled.length,
        };
    }, [subs.data, currency]);

    if (subs.loading || pl) {
        return <div><PageHeader title="Insights" /><div className="space-y-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div></div>;
    }
    if (view.t.activeCount === 0) {
        return (
            <div>
                <PageHeader title="Insights" />
                <EmptyState title="Nothing to read yet." body="Insights appear once you have active subscriptions." action={<LinkButton href="/import" variant="primary">Import a statement</LinkButton>} />
            </div>
        );
    }

    const yearly = view.ranked.reduce((a, s) => a + yearlyMinor(s), 0) || 1;
    const top = view.ranked[0];

    return (
        <div className="space-y-10">
            <PageHeader
                title="Where it goes"
                description={top ? `${top.name} is your biggest, at ${Math.round((yearlyMinor(top) / yearly) * 100)}% of the year.` : undefined}
            />

            <Section title="Weight" hint="Each block is one subscription, sized by yearly cost">
                <div className="flex h-14 gap-[3px] rounded-lg overflow-hidden" role="img" aria-label="Yearly cost split by subscription">
                    {view.ranked.map((s) => (
                        <div key={s.id} title={`${s.name}: ${formatMajor(toMajor(yearlyMinor(s)), currency, { whole: true })}/yr`} style={{ flexGrow: yearlyMinor(s), flexBasis: 0, minWidth: 6, background: categoryColor(s.category || 'Other') }} />
                    ))}
                </div>
                <div className="mt-6">
                    <BarList
                        currency={currency}
                        unit="/yr"
                        items={view.ranked.slice(0, 8).map((s) => ({ key: s.id, label: s.name, valueMinor: yearlyMinor(s), color: categoryColor(s.category || 'Other') }))}
                    />
                </div>
            </Section>

            <Section title="By category" hint="Monthly cost">
                <BarList
                    currency={currency}
                    unit="/mo"
                    items={view.categories.map((c) => ({ key: c.category, label: c.category, valueMinor: c.monthlyMinor, color: categoryColor(c.category), detail: `${(c.share * 100).toFixed(0)}% · ${c.count}` }))}
                />
            </Section>

            <Section title="Next 12 months" hint="From your real charge dates">
                <ForecastChart data={view.months} currency={currency} />
            </Section>

            <Section title="Calendar">
                <RenewalCalendar subs={subs.data} currency={currency} />
            </Section>

            <Section title="Committed">
                {profile?.monthly_income ? (
                    <CommittedGauge monthly={toMajor(view.t.monthlyMinor)} income={profile.monthly_income} currency={currency} />
                ) : (
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-ink-3">Add your monthly income to see how much of it is already spoken for.</p>
                        <LinkButton href="/settings" size="sm">Add income</LinkButton>
                    </div>
                )}
            </Section>

            {view.cancelledCount > 0 && (
                <Section title="Saved by cancelling">
                    <p className="font-display text-5xl text-accent tabular">{formatMajor(toMajor(view.savedYearly), currency, { whole: true })}<span className="text-lg text-ink-3 font-sans"> /yr</span></p>
                    <p className="text-sm text-ink-3 mt-1">From {view.cancelledCount} cancelled subscription{view.cancelledCount === 1 ? '' : 's'}.</p>
                </Section>
            )}
        </div>
    );
}
