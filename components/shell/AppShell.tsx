'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { icons } from './icons';

const NAV = [
    { href: '/', label: 'Overview', icon: 'overview' },
    { href: '/subscriptions', label: 'Subscriptions', icon: 'subscriptions' },
    { href: '/insights', label: 'Insights', icon: 'insights' },
    { href: '/import', label: 'Import', icon: 'import' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

const isCurrent = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export default function AppShell({ children }: { children: ReactNode }) {
    const path = usePathname();

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-canvas px-4 py-6">
                <Link href="/" className="flex items-center gap-2.5 px-2 mb-8">
                    <span className="w-8 h-8 rounded-lg bg-accent text-accent-ink flex items-center justify-center font-bold">S</span>
                    <span className="text-lg font-semibold tracking-tight">Subtrack</span>
                </Link>
                <nav aria-label="Main" className="flex flex-col gap-1">
                    {NAV.map((n) => {
                        const current = isCurrent(path, n.href);
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                aria-current={current ? 'page' : undefined}
                                className={`flex items-center gap-3 h-10 px-3 rounded-xl text-sm transition-colors ${current ? 'bg-raised text-ink font-medium' : 'text-ink-2 hover:text-ink hover:bg-surface'}`}
                            >
                                <span className={current ? 'text-accent' : ''}>{icons[n.icon]}</span>
                                {n.label}
                            </Link>
                        );
                    })}
                </nav>
                <p className="mt-auto px-2 text-xs text-ink-3 leading-relaxed">Your data stays on this device.</p>
            </aside>

            <main className="lg:pl-60 min-h-dvh">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-10 pb-28 lg:pb-12">{children}</div>
            </main>

            {/* Mobile bottom tab bar */}
            <nav
                aria-label="Main"
                className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-line bg-canvas/95 backdrop-blur"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {NAV.map((n) => {
                    const current = isCurrent(path, n.href);
                    return (
                        <Link
                            key={n.href}
                            href={n.href}
                            aria-current={current ? 'page' : undefined}
                            className={`flex flex-col items-center justify-center gap-1 h-16 text-[11px] ${current ? 'text-accent' : 'text-ink-3'}`}
                        >
                            {icons[n.icon]}
                            {n.label}
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
