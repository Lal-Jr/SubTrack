import { formatMajor } from '@/lib/format';

const SEGMENTS = 40;

/** A fuel-gauge style strip: how much of monthly income is already spoken for by subscriptions. */
export default function CommittedGauge({ monthly, income, currency }: { monthly: number; income: number; currency: string }) {
    const pct = income > 0 ? (monthly / income) * 100 : 0;
    const filled = Math.min(SEGMENTS, Math.round((pct / 100) * SEGMENTS));
    const tone = pct >= 20 ? 'bg-danger' : pct >= 10 ? 'bg-warn' : 'bg-accent';
    const word = pct >= 20 ? 'Heavy' : pct >= 10 ? 'Moderate' : 'Light';
    return (
        <div>
            <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-ink-2">
                    <span className="font-display text-3xl text-ink align-baseline">{pct.toFixed(pct < 10 ? 1 : 0)}%</span> of your income is committed
                </p>
                <p className="eyebrow">{word}</p>
            </div>
            <div className="mt-3 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} aria-label="Share of income committed to subscriptions">
                {Array.from({ length: SEGMENTS }).map((_, i) => (
                    <span key={i} className={`h-5 flex-1 rounded-[2px] ${i < filled ? tone : 'bg-raised'}`} />
                ))}
            </div>
            <p className="mt-2 text-xs text-ink-3 tabular">
                {formatMajor(monthly, currency, { whole: true })} a month of {formatMajor(income, currency, { whole: true })}
            </p>
        </div>
    );
}
