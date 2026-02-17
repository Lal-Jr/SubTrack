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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}>
        <nav className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 text-sm font-medium">
            <span className="mr-2 text-base font-semibold text-blue-600">Subtrack</span>
            <Link href="/">Dashboard</Link>
            <Link href="/transactions">Transactions</Link>
            <Link href="/subscriptions">Subscriptions</Link>
            <Link href="/import">Import</Link>
            <Link href="/settings">Settings</Link>
          </div>
        </nav>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
