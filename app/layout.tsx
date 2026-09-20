import type { Metadata } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import DBInit from './DBInit';
import SerwistInit from '@/components/SerwistInit';
import AppShell from '@/components/shell/AppShell';
import Welcome from '@/components/shell/Welcome';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const display = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
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
    statusBarStyle: "black-translucent",
    title: "Subtrack",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#0d0c0a',
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}>
        <SerwistInit />
        <DBInit />
        <AppShell>{children}</AppShell>
        <Welcome />
      </body>
    </html>
  );
}
