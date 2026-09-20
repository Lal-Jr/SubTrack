'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PRIMARY_SERIES } from '@/lib/chartColors';
import { formatMajor, formatShortDate } from '@/lib/format';
import type { MonthForecast } from '@/lib/subscriptions/totals';
import { toMajor } from '@/types/money';

const monthName = (ym: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });

interface Props {
    data: MonthForecast[];
    currency: string;
}

/** Scheduled charges per month. One series, so no legend; the card title names it. */
export default function ForecastChart({ data, currency }: Props) {
    const rows = data.map((m) => ({ ...m, label: monthName(m.month, { month: 'short' }), value: toMajor(m.totalMinor) }));
    // The heaviest month carries the signal color; the rest stay neutral so the eye lands on it.
    // A tie (e.g. identical months) has no peak to point at, so nothing is highlighted then.
    const max = Math.max(...rows.map((r) => r.value));
    const peak = rows.filter((r) => r.value === max).length === 1 ? max : -1;
    const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

    return (
        <div>
            <div className="h-56 sm:h-64" role="img" aria-label={`Bar chart of scheduled charges for the next ${data.length} months`}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#2a2721" />
                        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#3d3a32' }} tick={{ fill: '#8a8373', fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: '#8a8373', fontSize: 12 }} tickFormatter={(v: number) => compact.format(v)} />
                        <Tooltip cursor={{ fill: 'rgba(241,236,223,0.05)' }} content={<ForecastTooltip currency={currency} />} />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                            {rows.map((r) => <Cell key={r.month} fill={r.value === peak ? PRIMARY_SERIES : '#8a8373'} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <details className="mt-3 text-xs text-ink-3">
                <summary className="cursor-pointer hover:text-ink-2">View as table</summary>
                <table className="w-full mt-2 tabular">
                    <thead><tr className="text-left"><th className="py-1 font-medium">Month</th><th className="py-1 font-medium text-right">Scheduled</th></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.month} className="border-t border-line">
                                <td className="py-1.5 text-ink-2">{monthName(r.month, { month: 'long', year: 'numeric' })}{r.partial ? ' (rest of month)' : ''}</td>
                                <td className="py-1.5 text-right text-ink">{formatMajor(r.value, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}

interface TipProps {
    active?: boolean;
    payload?: { payload: MonthForecast & { label: string; value: number } }[];
    currency: string;
}

function ForecastTooltip({ active, payload, currency }: TipProps) {
    if (!active || !payload?.length) return null;
    const m = payload[0].payload;
    const top = [...m.charges].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 4);
    return (
        <div className="bg-raised border border-line-strong rounded-xl px-3 py-2.5 shadow-xl text-xs min-w-40">
            <p className="text-ink-2">{monthName(m.month, { month: 'long', year: 'numeric' })}{m.partial ? ' (rest of month)' : ''}</p>
            <p className="font-display text-2xl mt-0.5 tabular">{formatMajor(m.value, currency)}</p>
            {top.length > 0 && (
                <ul className="mt-2 space-y-1 tabular">
                    {top.map((c, i) => (
                        <li key={i} className="flex justify-between gap-4 text-ink-2">
                            <span className="truncate">{c.name} · {formatShortDate(c.date)}</span>
                            <span>{formatMajor(toMajor(c.amountMinor), currency)}</span>
                        </li>
                    ))}
                    {m.charges.length > top.length && <li className="text-ink-3">+{m.charges.length - top.length} more</li>}
                </ul>
            )}
        </div>
    );
}
