import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import './register-sw';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Subtrack',
  description: 'Offline-first personal finance & subscription analyzer',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/icon.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}>
        <div className="bg-blob blob-1" />
        <div className="bg-blob blob-2" />
        <div className="bg-blob blob-3" />
        <nav className="sticky top-0 z-10 border-b border-white/20 bg-white/60 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium">
            <span className="mr-2 text-base font-semibold gradient-title">Subtrack</span>
            <Link className="nav-pill" href="/">Dashboard</Link>
            <Link className="nav-pill" href="/transactions">Transactions</Link>
            <Link className="nav-pill" href="/subscriptions">Subscriptions</Link>
            <Link className="nav-pill" href="/import">Import</Link>
            <Link className="nav-pill" href="/settings">Settings</Link>
          </div>
        </nav>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
