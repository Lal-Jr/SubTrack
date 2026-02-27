import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import DBInit from './DBInit';

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-50`}>
        <DBInit />
        <div className="bg-blob blob-1" />
        <div className="bg-blob blob-2" />
        <div className="bg-blob blob-3" />
        <header className="flex w-full items-center justify-between px-6 py-4 shrink-0 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 relative z-10">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Subtrack</Link>
          <Link className="nav-pill" href="/profile">Profile</Link>
        </header>
        <main className="flex-1 w-full overflow-hidden relative z-10">{children}</main>
      </body>
    </html>
  );
}
