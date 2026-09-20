# Subtrack

A private, offline-first subscription tracker. It finds your recurring payments in bank statements, shows what is about to leave your account and when, and tells you what is worth acting on. Everything lives on your device.

> **Status:** the local app is complete and usable. Opt-in multi-device sync (Phase 5) is designed and partly scaffolded but **not implemented yet**; see [Roadmap](#roadmap).

## What it does

| Screen | What you get |
| --- | --- |
| **Runway** (home) | KPI strip (per month, per year and per day, next 30 days, next charge), a 30/90-day timeline where each charge is a bead sized by its amount, an aligned table of upcoming charges, category split, income-committed gauge, and **Worth a look** insights. |
| **Subscriptions** | A sortable, filterable table (status, category, search) with per-month and per-charge cost, totals row, and a shared edit / cancel / resume / delete sheet. |
| **Insights** | Yearly weight by subscription, category breakdown, a 12-month schedule built from real charge dates, a renewal calendar, savings from cancelled subscriptions. |
| **Import** | Drag and drop a bank statement (CSV or PDF). Column mapping when detection is unsure, duplicate-safe re-imports, and a review step before anything is saved. |
| **Settings** | Profile (name, currency, income), sample data, backup download / restore (merge or replace), delete everything. |

**Worth a look** examples (computed from your data, not canned text): a large annual charge coming up and how big it is against a normal month, renewals in the next three days, one subscription dominating your spend, several subscriptions crowding one category, and your cost per day.

**Sample data:** on the very first launch of an empty app, six example subscriptions are added (iCloud, YouTube Premium, Google Cloud, Claude, Netflix, Adobe Lightroom) so the dashboard is not empty. They are tagged, can be removed from the home banner or Settings, and never come back once removed or replaced by your own data.

## Privacy

- Statements are parsed **in the browser**. Nothing is uploaded.
- Data is stored in a local SQLite database (OPFS). The app works fully offline.
- There is no account, no analytics and no network dependency in the default build.
- Use **Settings → Download backup** to move data between devices today.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 with design tokens in `app/globals.css`. Dark theme only.
- **Type:** Geist (UI), Geist Mono (dates and labels), Instrument Serif (headline figures)
- **Local database:** `@powersync/web` over `@journeyapps/wa-sqlite` (SQLite on OPFS)
- **Parsing:** PapaParse (CSV), pdf.js (PDF)
- **Charts:** Recharts for the schedule chart; the runway, bars, gauge and calendar are plain HTML/SVG
- **PWA:** Serwist service worker and a web manifest
- **Tests:** Vitest

## Getting started

Requires Node 18+ and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

If port 3000 is taken: `npx next dev -p 3111`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

**Environment variables are optional.** The default build needs none. They only matter for the planned cloud sync:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_POWERSYNC_URL=
```

Keep them in `.env.local` (gitignored). When any of them is missing, the sync option stays hidden.

## Architecture

```
app/                   Next.js routes: / (Runway), /subscriptions, /insights, /import, /settings
components/
  shell/               App shell (top bar + mobile dock), add flow, first-run welcome
  home/  runway/       Dashboard parts, runway timeline, income gauge
  charts/              Forecast chart, bar lists, renewal calendar
  subscriptions/       Edit sheet, form, category tag
  import/              Import flow and column-mapping step
  ui/                  Button, Card/Section, Field, Dialog, Badge, PageHeader
lib/
  db/                  Schema, migrations, backup format, sample data, first-run seeding
  detection/           Subscription detection engine (pure, no I/O)
  import/              CSV / PDF parsing, dates and amounts, duplicate keys, persistence
  subscriptions/       Schedule math, totals and forecast, insights, persistence
  sync/                SyncProvider seam (no-op by default) + Supabase groundwork
  hooks/               useLiveQuery, useSubscriptions, useProfile
types/                 Integer-money helpers
__tests__/             Detection, import, schedule/totals/insights, backup, migrations, money
```

### Data layer

Local tables: `subscriptions`, `profiles`, `transactions`, and a device-local `settings` table (schema version, first-run flag; never synced or backed up). Additive schema changes are applied by PowerSync from `lib/db/schema.ts`; one-off data transforms live in versioned migrations (`lib/db/migrations.ts`). Transaction amounts are **integer minor units**; subscription amounts are still major-unit numbers (see [Known limitations](#known-limitations)).

### Detection engine (`lib/detection`)

One pipeline: drop unusable and excluded rows (loans, EMIs, salary, self transfers) → normalize merchants (known-merchant rules first, then strip payment rails, handles and reference numbers) → group → cancel refunded debits (same amount within 7 days) → find the billing frequency from the gaps between charges → check the amounts → grade the result.

- **Frequencies:** weekly, biweekly, monthly, quarterly, yearly.
- **Status:** `confirmed` (3+ regular charges), `probable` (2), `possible` (one charge from a known subscription merchant).
- **Price changes** are detected (a single step from one price level to another); constantly varying amounts from unknown merchants are treated as bills, not subscriptions.
- **Lapsed** subscriptions (no charge for over two cycles) are flagged inactive.
- Known merchants and noise words are data in `lib/detection/merchants.ts`; callers can pass extra rules.

### Import (`lib/import`)

- **CSV:** finds the header row below account metadata, maps date, description, debit/credit or a signed amount (optionally with a Dr/Cr column), infers day-first vs month-first dates from the data and asks you when it is ambiguous. Handles BOMs and other delimiters.
- **PDF:** reads text with pdf.js and decides debit vs credit from how the running balance moves (oldest-first or newest-first statements), trusts `Dr`/`Cr` suffixes, and warns when it had to guess. Password-protected and scanned PDFs get a clear message.
- **Duplicates:** every row gets a stable key, so re-importing or importing an overlapping statement adds nothing twice. Detection runs over all stored transactions plus the new ones, so it improves as you import more months.

## Testing

`npm test` runs the pure logic: detection, parsers, schedules, totals, insights, backup format and migrations. The UI is verified manually; there are no component or end-to-end tests yet.

## Roadmap

### Phase 5: opt-in multi-device sync (planned, not built)

The app stays **local-first and account-free by default**. Sync is an option you turn on later, and turning it off returns to local-only without losing data.

Already in place:

- A `SyncProvider` interface (`lib/sync/types.ts`) with a no-op default. The app only talks to this interface, and the Supabase provider is loaded on demand, so local-only users never download backend code.
- A Supabase connector that **requires a signed-in user** (no anonymous fallback) and handles upload errors: transient errors are retried, permanently invalid rows are dropped so one bad row cannot block the queue.
- The sync option is hidden unless the three environment variables above are set.
- PowerSync queues local writes even while offline, which is what lets existing data upload on first enable.

To build:

1. **Auth:** Supabase magic-link sign-in only, offered when the user enables sync.
2. **Row security:** `user_id` on every synced table; RLS policy `user_id = auth.uid()`; SQL migrations under `supabase/`.
3. **Sync rules:** PowerSync rules scoped by user; add `user_id` to the local schema.
4. **UI:** Settings toggle, a sync status indicator (off, connecting, syncing, synced, error), and a first-enable flow that uploads existing local data.
5. **Testing:** end-to-end against a real Supabase project and PowerSync instance.

Prerequisite: a Supabase project and a PowerSync instance.

### Phase 6: polish

- Offline verification of the installed PWA
- Accessibility pass (contrast, keyboard, chart labelling)
- Real-device testing on phones

## Known limitations

- **Currencies are not converted.** Totals use your main currency; subscriptions in other currencies are excluded and the app says so.
- **Subscription amounts are floating point** in the database. Transactions use integer minor units. Converting subscriptions is planned.
- **The merchant list is a starter set** (a mix of global and Indian services), not exhaustive. Unknown merchants are still detected from their charge pattern.
- **PDF parsing** was built against typical layouts and synthetic fixtures. Unusual statement formats may need a CSV export or a mapping fix; please report them.
- **No conflict handling** yet because there is no sync. Restore-from-backup "merge" overwrites rows with the same id.
- The UI has been checked in desktop Chrome and a phone-width frame, not on physical devices.
