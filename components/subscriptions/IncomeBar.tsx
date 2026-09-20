import { formatMajor } from '@/lib/format';
import { toMajor, type Minor } from '@/types/money';

/** Share of monthly income that goes to subscriptions. Tone escalates with the share, with a text label. */
export default function IncomeBar({ monthlyMinor, income, currency }: { monthlyMinor: Minor; income: number; currency: string }) {
    const pct = income > 0 ? (toMajor(monthlyMinor) / income) * 100 : 0;
    const tone = pct >= 20 ? { bar: 'bg-danger', label: 'High', text: 'text-danger' } : pct >= 10 ? { bar: 'bg-warn', label: 'Moderate', text: 'text-warn' } : { bar: 'bg-accent', label: 'Healthy', text: 'text-accent' };
    return (
        <div>
            <div className="flex items-baseline justify-between">
                <p className="text-3xl font-semibold tabular">{pct.toFixed(1)}%</p>
                <p className={`text-xs font-medium ${tone.text}`}>{tone.label}</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-raised overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} aria-label="Share of income spent on subscriptions">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-3 tabular">
                {formatMajor(toMajor(monthlyMinor), currency, { whole: true })} of {formatMajor(income, currency, { whole: true })} monthly income
            </p>
        </div>
    );
}
