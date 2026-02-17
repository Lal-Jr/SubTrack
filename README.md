# Subtrack — Offline-First Personal Finance & Subscription Analyzer

Subtrack is a production-ready offline-first PWA that stores all data locally in IndexedDB, imports bank CSVs, auto-categorizes expenses, detects subscriptions, and forecasts future balance.

## Features

- 100% offline after first load (IndexedDB + Workbox)
- Manual transaction CRUD
- CSV import with column mapping + dedupe
- Rule-based auto-categorization
- Subscription detection (monthly/yearly)
- Dashboard with charts (Recharts)
- Forecast engine (next 6 months)
- PWA manifest + offline fallback

## Tech Stack

- Next.js (App Router)
- React
- Dexie (IndexedDB)
- Workbox Service Worker
- Recharts
- PapaParse

## Run Instructions

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Open http://localhost:3000

## Offline + PWA

- Service worker is registered automatically in [app/register-sw.ts](app/register-sw.ts)
- Manifest is in [public/manifest.json](public/manifest.json)
- Offline fallback is in [public/offline.html](public/offline.html)

## Project Pages

- Dashboard: charts, totals, forecast
- Transactions: add/edit/delete
- Subscriptions: detected recurring charges
- Import: CSV mapping + preview
- Settings: categories + rules
