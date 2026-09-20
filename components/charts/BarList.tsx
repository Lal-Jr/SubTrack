import { formatMajor } from '@/lib/format';
import { toMajor, type Minor } from '@/types/money';

export interface BarItem {
    key: string;
    label: string;
    valueMinor: Minor;
    color: string;
    detail?: string;
}

/**
 * Ranked horizontal bars. Every row is labelled with its value, so identity never depends on color alone.
 */
export default function BarList({ items, currency, unit, bars = true }: { items: BarItem[]; currency: string; unit: string; bars?: boolean }) {
    const max = Math.max(...items.map((i) => i.valueMinor), 1);
    return (
        <ul className={bars ? 'space-y-3.5' : ''}>
            {items.map((i) => (
                <li key={i.key} className={bars ? '' : 'py-2'}>
                    <div className="flex items-baseline gap-3 text-sm">
                        <span className={`flex items-center gap-2 min-w-0 ${bars ? 'flex-1' : ''}`}>
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.color }} aria-hidden />
                            <span className="truncate text-ink">{i.label}</span>
                            {i.detail && <span className="text-xs text-ink-3 shrink-0">{i.detail}</span>}
                        </span>
                        {!bars && <span className="leader" aria-hidden />}
                        <span className={`tabular text-ink shrink-0 ${bars ? 'ml-auto' : ''}`}>
                            {formatMajor(toMajor(i.valueMinor), currency)}
                            <span className="text-ink-3 text-xs"> {unit}</span>
                        </span>
                    </div>
                    {bars && <div className="mt-1.5 h-1.5 rounded-full bg-raised overflow-hidden" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.valueMinor / max) * 100)}%`, background: i.color }} />
                    </div>}
                </li>
            ))}
        </ul>
    );
}
