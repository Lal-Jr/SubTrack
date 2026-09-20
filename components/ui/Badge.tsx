import type { ReactNode } from 'react';

const TONES = {
    neutral: 'bg-raised text-ink-2 border-line-strong',
    good: 'bg-accent-soft text-accent border-accent/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
} as const;

/** Status badges always carry text, never color alone. */
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
    return <span className={`inline-flex items-center px-2 h-5 rounded-full border text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
}
