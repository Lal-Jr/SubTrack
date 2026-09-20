import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink hover:bg-accent-strong font-semibold',
    secondary: 'bg-raised text-ink border border-line-strong hover:border-ink-3',
    ghost: 'text-ink-2 hover:text-ink hover:bg-raised',
    danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
};
const SIZES: Record<Size, string> = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm' };

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md') =>
    `inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]}`;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

export function Button({ variant, size, className = '', type = 'button', ...rest }: Props) {
    return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}

export function LinkButton({ href, variant, size, children, className = '' }: { href: string; variant?: Variant; size?: Size; children: ReactNode; className?: string }) {
    return <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>{children}</Link>;
}
