import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div className="min-w-0">
                <h1 className="font-display text-5xl sm:text-6xl leading-[0.95] tracking-tight">{title}</h1>
                {description && <p className="text-sm text-ink-3 mt-3">{description}</p>}
            </div>
            {action}
        </header>
    );
}
