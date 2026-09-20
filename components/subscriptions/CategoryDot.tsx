import { categoryColor } from '@/lib/chartColors';

export function CategoryTag({ category }: { category: string | null }) {
    const name = category || 'Other';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="w-2 h-2 rounded-sm" style={{ background: categoryColor(name) }} aria-hidden />
            {name}
        </span>
    );
}
