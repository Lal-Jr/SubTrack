'use client';

import type { ColumnMapping, CsvOptions, DateOrder } from '@/lib/import';
import { extractCsv, type Grid } from '@/lib/import';
import { formatMoney } from '@/types/money';

interface Props {
    grid: Grid;
    options: CsvOptions;
    currency: string;
    dateOrderAmbiguous: boolean;
    onChange: (o: CsvOptions) => void;
}

const selectCls = 'w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2 py-1.5 text-sm';

export default function MappingStep({ grid, options, currency, dateOrderAmbiguous, onChange }: Props) {
    const { mapping, headerRow } = options;
    const headers = grid[headerRow] ?? [];
    const splitColumns = mapping.amount === undefined;
    const set = (patch: Partial<ColumnMapping>) => onChange({ ...options, mapping: { ...mapping, ...patch } });

    const columnSelect = (label: string, value: number | undefined, onPick: (v: number | undefined) => void, optional = false) => (
        <label className="block">
            <span className="label block mb-1">{label}</span>
            <select
                className={selectCls}
                value={value ?? ''}
                onChange={(e) => onPick(e.target.value === '' ? undefined : Number(e.target.value))}
            >
                {optional && <option value="">None</option>}
                {headers.map((h, i) => (
                    <option key={i} value={i}>{`${i + 1}. ${h || '(blank)'}`}</option>
                ))}
            </select>
        </label>
    );

    const preview = extractCsv(grid, options).transactions.slice(0, 5);

    return (
        <div className="space-y-4">
            <p className="text-sm text-zinc-400">
                Check that the columns match your statement. You can change anything that looks wrong.
            </p>

            <label className="block">
                <span className="label block mb-1">Header row</span>
                <select className={selectCls} value={headerRow} onChange={(e) => onChange({ ...options, headerRow: Number(e.target.value) })}>
                    {grid.slice(0, 30).map((row, i) => (
                        <option key={i} value={i}>{`Row ${i + 1}: ${row.filter(Boolean).slice(0, 4).join(' | ')}`}</option>
                    ))}
                </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
                {columnSelect('Date', mapping.date, (v) => v !== undefined && set({ date: v }))}
                {columnSelect('Description', mapping.description, (v) => v !== undefined && set({ description: v }))}
            </div>

            <div className="flex gap-2 text-sm">
                {([false, true] as const).map((split) => (
                    <button
                        key={String(split)}
                        type="button"
                        onClick={() =>
                            onChange({
                                ...options,
                                mapping: split
                                    ? { date: mapping.date, description: mapping.description, debit: mapping.debit ?? 2, credit: mapping.credit ?? 3 }
                                    : { date: mapping.date, description: mapping.description, amount: mapping.amount ?? 2, type: mapping.type },
                            })
                        }
                        className={`px-3 py-1.5 rounded-lg border ${splitColumns === split ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-zinc-700 text-zinc-400'}`}
                    >
                        {split ? 'Separate debit / credit columns' : 'One amount column'}
                    </button>
                ))}
            </div>

            {splitColumns ? (
                <div className="grid grid-cols-2 gap-3">
                    {columnSelect('Debit / withdrawal', mapping.debit, (v) => set({ debit: v }))}
                    {columnSelect('Credit / deposit', mapping.credit, (v) => set({ credit: v }))}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {columnSelect('Amount', mapping.amount, (v) => v !== undefined && set({ amount: v }))}
                        {columnSelect('Dr/Cr column', mapping.type, (v) => set({ type: v }), true)}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                            type="checkbox"
                            checked={options.positiveIsDebit}
                            onChange={(e) => onChange({ ...options, positiveIsDebit: e.target.checked })}
                        />
                        Positive amounts are purchases (typical for credit card exports)
                    </label>
                </div>
            )}

            <label className="block">
                <span className="label block mb-1">Date format</span>
                <select className={selectCls} value={options.dateOrder} onChange={(e) => onChange({ ...options, dateOrder: e.target.value as DateOrder })}>
                    <option value="dmy">Day first (31/12/2025)</option>
                    <option value="mdy">Month first (12/31/2025)</option>
                </select>
                {dateOrderAmbiguous && (
                    <span className="text-xs text-amber-400 mt-1 block">
                        Every date in this file could be read either way. Check the preview below.
                    </span>
                )}
            </label>

            <div className="rounded-lg border border-zinc-800 overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="text-zinc-500 text-left">
                        <tr><th className="p-2">Date</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th></tr>
                    </thead>
                    <tbody>
                        {preview.length === 0 && (
                            <tr><td colSpan={3} className="p-3 text-zinc-500">No rows can be read with these settings.</td></tr>
                        )}
                        {preview.map((t, i) => (
                            <tr key={i} className="border-t border-zinc-800">
                                <td className="p-2 whitespace-nowrap">{t.date}</td>
                                <td className="p-2 max-w-[220px] truncate" title={t.description}>{t.description}</td>
                                <td className={`p-2 text-right whitespace-nowrap ${t.amountMinor < 0 ? 'text-zinc-200' : 'text-emerald-400'}`}>
                                    {formatMoney(t.amountMinor, currency)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
