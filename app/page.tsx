'use client';

import { useMemo, useState } from 'react';
import CommittedGauge from '@/components/runway/CommittedGauge';
import RunwayTrack, { chargeKey } from '@/components/runway/RunwayTrack';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, Section, Skeleton } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Field';
import { useAddSubscription } from '@/components/shell/AddMenu';
import { formatDate, formatMajor, formatShortDate, relativeDays } from '@/lib/format';
import { useProfile, useSubscriptions } from '@/lib/hooks/useData';
import { chargesInWindow, todayUtc } from '@/lib/subscriptions/schedule';
import { totals } from '@/lib/subscriptions/totals';
import { toMajor } from '@/types/money';

type Range = '30' | '90';

export default function RunwayPage() {
    const subs = useSubscriptions();
    const { profile, currency, loading: profileLoading } = useProfile();
    const { openManual: openAdd } = useAddSubscription();
    const [range, setRange] = useState<Range>('30');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const days = Number(range);
    const loading = subs.loading || profileLoading;

    const view = useMemo(() => {
        const today = todayUtc();
        // Charges in other currencies are not converted, so they stay off the track.
        const charges = chargesInWindow(subs.data.filter((s) => (s.currency ?? currency) === currency), today, days);
        return {
            charges,
            total: charges.reduce((a, c) => a + c.amount, 0),
            t: totals(subs.data, currency),
        };
    }, [subs.data, currency, days]);

    const selected = view.charges.find((c) => chargeKey(c) === selectedKey) ?? null;
    const first = view.charges[0];
    const firstName = profile?.name?.split(' ')[0];

    if (loading) {
        return <div className="space-y-6"><Skeleton className="h-28" /><Skeleton className="h-44" /><Skeleton className="h-40" /></div>;
    }

    if (subs.data.length === 0) {
        return (
            <EmptyState
                title={firstName ? `Nothing on the runway yet, ${firstName}.` : 'Nothing on the runway yet.'}
                body="Import a bank statement and Subtrack will find your recurring payments, or add one by hand."
                action={<div className="flex gap-2 mt-2"><LinkButton href="/import" variant="primary">Import a statement</LinkButton><button onClick={openAdd} className="h-11 px-5 rounded-full border border-line-strong text-sm hover:bg-raised">Add manually</button></div>}
            />
        );
    }

    return (
        <div className="space-y-10">
            <div>
                <p className="eyebrow mb-4">{firstName ? `${firstName}, next ${days} days` : `Next ${days} days`}</p>
                <h1 className="font-display leading-[0.98] tracking-tight text-[clamp(2.6rem,9vw,4.6rem)]">
                    <span className="text-accent">{formatMajor(view.total, currency, { whole: true })}</span> leaves your account{' '}
                    <span className="text-ink-2 italic">
                        across {view.charges.length} charge{view.charges.length === 1 ? '' : 's'}.
                    </span>
                </h1>
                <p className="text-sm text-ink-3 mt-4">
                    {first ? `Next up is ${first.sub.name}, ${relativeDays(first.daysUntil).toLowerCase()}.` : 'Nothing is due in this window.'}
                    {view.t.otherCurrencyCount > 0 && ` ${view.t.otherCurrencyCount} subscription${view.t.otherCurrencyCount === 1 ? '' : 's'} in other currencies not counted.`}
                </p>
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

            <Section title="Coming up" hint={`${view.charges.length} in ${days} days`}>
                {view.charges.length === 0 ? (
                    <p className="text-sm text-ink-3">No charges in this window.</p>
                ) : (
                    <ol>
                        {view.charges.slice(0, 12).map((c) => {
                            const key = chargeKey(c);
                            return (
                                <li key={key}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedKey(key === selectedKey ? null : key)}
                                        className={`w-full flex items-baseline gap-3 py-3 text-left transition-colors ${key === selectedKey ? 'text-accent' : 'hover:text-accent'}`}
                                    >
                                        <span className="eyebrow w-14 shrink-0 !text-inherit opacity-70">{formatShortDate(c.date)}</span>
                                        <span className="truncate">{c.sub.name}</span>
                                        <span className="leader" aria-hidden />
                                        <span className="tabular shrink-0">{formatMajor(c.amount, c.sub.currency ?? currency)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </Section>

            <div className="grid grid-cols-3 border-t border-line pt-4">
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
        </div>
    );
}
