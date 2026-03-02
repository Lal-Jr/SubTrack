import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import DBInit from './DBInit';
import SerwistInit from '@/components/SerwistInit';
import HeaderImportButton from '@/components/HeaderImportButton';
import WelcomeModal from '@/components/WelcomeModal';

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
  applicationName: "Subtrack",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Subtrack",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
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
        <link rel="icon" href="/icon.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen w-screen overflow-hidden flex flex-col bg-black text-slate-50`}>
        <SerwistInit />
        <DBInit />
        <header className="flex w-full items-center justify-between px-6 py-4 shrink-0 bg-[#09090b] border-b border-zinc-800 relative z-10">
          <Link href="/" className="text-xl font-bold text-white">Subtrack</Link>
          <HeaderImportButton />
        </header>
        <WelcomeModal />
        <main className="flex-1 w-full overflow-hidden relative z-10">{children}</main>
      </body>
    </html>
  );
}
