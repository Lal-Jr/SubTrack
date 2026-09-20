import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const control =
    'w-full h-11 bg-transparent border border-line-strong rounded-xl px-3.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-50';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-medium text-ink-2 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-xs text-ink-3 mt-1">{hint}</span>}
        </label>
    );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={`${control} ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select className={`${control} ${className}`} {...rest} />;
}

/** A pill-style single choice control. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 border border-line-strong rounded-full">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`px-3.5 h-8 rounded-full text-[13px] transition-colors ${value === o.value ? 'bg-ink text-canvas font-medium' : 'text-ink-3 hover:text-ink'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
