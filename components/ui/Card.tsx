import type { HTMLAttributes, ReactNode } from 'react';

/** A quiet panel. Used sparingly: most structure comes from Section and hairlines. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={`bg-surface border border-line rounded-2xl ${className}`} {...rest} />;
}

/** A titled block separated by a hairline rule instead of a box. */
export function Section({ title, hint, action, children, className = '' }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`border-t border-line pt-4 ${className}`}>
            <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 className="eyebrow">{title}</h2>
                {action ?? (hint && <p className="text-xs text-ink-3">{hint}</p>)}
            </div>
            {children}
        </section>
    );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
            </div>
            {action}
        </div>
    );
}

export function Skeleton({ className = '' }: { className?: string }) {
    return <div aria-hidden className={`animate-pulse bg-raised rounded-lg ${className}`} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-start gap-3 py-10">
            <p className="font-display text-4xl leading-none text-ink">{title}</p>
            <p className="text-sm text-ink-2 max-w-sm">{body}</p>
            {action}
        </div>
    );
}
