# Subtrack

An offline-first, privacy-focused Progressive Web Application (PWA) designed to help you analyze personal finances, track subscriptions, and project future spending—all powered by fast, local processing.

## ✨ Features

- **Offline-First PWA:** Install Subtrack on desktop or mobile. Stays 100% functional offline using Next.js, Serwist, Workbox, PowerSync, and local SQLite storage.
- **Smart Statement Import (CSV & PDF):** Securely parse bank statements completely in-browser. No sensitive financial data leaves your device. Features intelligent column mapping, transaction deduplication, and direct parsing engine integrations for both CSV and PDF files.
- **Subscription Intelligence:** 
  - Automatically identifies subscriptions and recurring charges from transaction data.
  - Granular management with custom billing intervals (e.g., monthly, yearly, custom interval days).
  - Advanced reactivity: The spend projection charts immediately update to reflect your potential savings whenever a subscription status is modified or cancelled.
- **Financial Dashboard & Forecasting:** A premium, responsive interface featuring dynamic Quick Stats widgets and Recharts-powered graphs. Includes a forecasting engine to project balances and spending for the next 6 months.
- **Rule-Based Categorization:** Automatically categorize expenses based on user-defined rules, alongside full manual CRUD support for individual transactions.
- **Robust Architecture:** Uses Supabase and PowerSync (with local SQLite) for real-time offline-first database synchronization.

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (Sleek UI with rich gradients and aesthetic visual hierarchy)
- **Database & State:** Supabase, `@powersync/web`, `@journeyapps/wa-sqlite`
- **PWA Capabilities:** `@serwist/next`, `workbox-window`
- **Data Visualization:** Recharts
- **Parsing Engines:** PapaParse (CSV), PDF.js (PDF)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation & Running Locally

1. **Clone the repository** (if you haven't already) and navigate to the project directory:
   ```bash
   cd subtrack
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

## 🏗 Architecture

Subtrack employs a modern offline-first React architecture emphasizing low latency, data privacy, and a seamless developer-to-user experience. 

### Data Flow & Offline Sync
1. **Local First Strategy:** All data operations (reads/writes) occur locally against a WebAssembly SQLite database using `@journeyapps/wa-sqlite`. This guarantees an instant UI response regardless of network conditions.
2. **Sync Engine:** `@powersync/web` constantly monitors the local SQLite database and handles bidirectional background synchronization with a remote **Supabase** instance.
3. **Connection State:** Changes made while offline are queued locally and automatically pushed to Supabase once network connectivity is restored. 

### Parsing Module
- File uploads never hit a server. `CSVUploadComponent` routes tabular data through `PapaParse` and complex PDF statements through `PDF.js` natively in the client browser, parsing transactions locally before writing them to the SQLite offline state.

## 📂 Folder Structure

```
subtrack/
├── app/                  # Next.js 16 App Router pages and layouts
│   ├── manifest.ts       # PWA Dynamic Manifest 
│   ├── sw.ts             # Serwist Service Worker configuration
│   ├── globals.css       # Tailwind entry point + root CSS variables
│   └── page.tsx          # Main Dashboard
├── components/           # React Components (UI & Logic)
│   ├── AddSubscription...# Forms to manually add recurring charges
│   ├── CSVUploadComponent# PDF/CSV drag-and-drop parser interface
│   ├── SubscriptionTable # Reactive data table for active subscriptions
│   └── *Widget.tsx       # Pluggable dashboard cards (Charts, Quick Stats)
├── lib/                  # Core Business Logic & Infrastructure
│   ├── powersync.ts      # PowerSync client initialization & schema
│   ├── statementParser.ts# File parsing orchestration
│   ├── subDetection.ts   # Core algorithms identifying recurring transactions
│   └── supabaseConnect...# Supabase authentication and connection
├── types/                # Shared TypeScript Definitions
└── public/               # Static assets & icons
```

## 📁 Key Modules

- **Dashboard:** Interactive overview of financial health, quick action widgets, and immediate 6-month forecasting.
- **Subscriptions Table (`SubscriptionTable.tsx`):** Detailed, reactive data table for managing active or cancelled subscriptions with deep insights into renewal dates.
- **Import Module:** Browser-native parser (`CSVUploadComponent`) leveraging PDF.js and PapaParse to extract and normalize transactions safely.
- **Profile & Settings:** Configure automated category rules, intervals, and personalize the application's behavior.
