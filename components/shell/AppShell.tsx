'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AddProvider, useAddSubscription } from './AddMenu';
import { icons } from './icons';

const NAV = [
    { href: '/', label: 'Runway', icon: 'overview' },
    { href: '/subscriptions', label: 'List', icon: 'subscriptions' },
    { href: '/insights', label: 'Insights', icon: 'insights' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

const isCurrent = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

function Wordmark() {
    return (
        <Link href="/" className="font-display text-3xl leading-none tracking-tight">
            subtrack<span className="text-accent">.</span>
        </Link>
    );
}

function DockLink({ n, current }: { n: (typeof NAV)[number]; current: boolean }) {
    return (
        <Link href={n.href} aria-current={current ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-0.5 h-full text-[10px] ${current ? 'text-accent' : 'text-ink-3'}`}>
            {icons[n.icon]}
            {n.label}
        </Link>
    );
}

function Shell({ children }: { children: ReactNode }) {
    const path = usePathname();
    const { open } = useAddSubscription();
    // The home page bleeds wider for the billboard and rows; text-heavy pages keep a reading column.
    const wide = path === '/';
    const left = NAV.slice(0, 2);
    const right = NAV.slice(2);

    return (
        <>
            {/* Top bar: wordmark, pill nav (desktop), add */}
            <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-5 h-16 flex items-center justify-between gap-4`}>
                    <Wordmark />
                    <nav aria-label="Main" className="hidden md:flex items-center gap-1">
                        {NAV.map((n) => {
                            const current = isCurrent(path, n.href);
                            return (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    aria-current={current ? 'page' : undefined}
                                    className={`h-9 px-4 rounded-full text-sm inline-flex items-center transition-colors ${current ? 'bg-ink text-canvas font-medium' : 'text-ink-2 hover:text-ink'}`}
                                >
                                    {n.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <button onClick={open} className="hidden md:inline-flex h-10 pl-4 pr-5 rounded-full bg-accent text-accent-ink text-sm font-semibold items-center gap-1.5 hover:bg-accent-strong">
                        <span className="text-lg leading-none -mt-0.5">+</span> Add
                    </button>
                </div>
            </header>

            <main className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-5 pt-6 md:pt-8 pb-32 md:pb-20 min-h-[calc(100dvh-4rem)]`}>{children}</main>

            {/* Mobile dock: thumb-reach navigation with a raised add button in the middle */}
            <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
                <div className="relative mx-auto max-w-sm h-16 rounded-full bg-raised/95 backdrop-blur border border-line-strong grid grid-cols-5 items-center shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                    {left.map((n) => <DockLink key={n.href} n={n} current={isCurrent(path, n.href)} />)}
                    <div className="flex justify-center">
                        <button onClick={open} aria-label="Add" className="w-14 h-14 -mt-1 rounded-full bg-accent text-accent-ink text-3xl leading-none flex items-center justify-center shadow-[0_0_0_6px_var(--color-canvas)] active:scale-95 transition-transform">
                            +
                        </button>
                    </div>
                    {right.map((n) => <DockLink key={n.href} n={n} current={isCurrent(path, n.href)} />)}
                </div>
            </nav>
        </>
    );
}

export default function AppShell({ children }: { children: ReactNode }) {
    return (
        <AddProvider>
            <Shell>{children}</Shell>
        </AddProvider>
    );
}
