import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={`bg-surface border border-line rounded-card ${className}`} {...rest} />;
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
        <div className="flex flex-col items-center text-center gap-3 py-12 px-6">
            <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center" aria-hidden>
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            </div>
            <p className="text-ink font-medium">{title}</p>
            <p className="text-sm text-ink-3 max-w-sm">{body}</p>
            {action}
        </div>
    );
}
