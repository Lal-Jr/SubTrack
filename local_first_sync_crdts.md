# 🌐 Local-First Sync: The CRDT approach

You've chosen the hardest, but most robust path: **Level 3 - Local-First Sync using CRDTs** (Conflict-Free Replicated Data Types). 

Unlike traditional cloud-first apps where the server is the single source of truth, a **Local-First** application treats your local database (IndexedDB/Dexie) as the primary database. The server exists merely to sync changes (events) between your devices in the background.

To do this effectively, we use CRDTs. Here is a deep dive into the pros, cons, and exactly what you are signing up for.

---

## 📈 The Pros (Why it's the "Holy Grail")

### 1. Zero Latency (Instant UI)
Because the app always reads from and writes to the *local* database first, every action is instantaneous. You click "Add Transaction", and it appears instantly without waiting for a server round-trip.

### 2. 100% Offline Capability
If you lose internet on a flight or in a tunnel, the app functions perfectly. You can add, edit, and delete transactions. The CRDT engine simply queues these changes locally.

### 3. Magical Conflict Resolution
This is the core power of a CRDT. 
*   **Scenario**: You are offline. On your phone, you edit the amount of a transaction from $50 to $60. On your laptop (also offline), you edit the *category* of that exact same transaction from "Food" to "Groceries".
*   **The Magic**: When both devices finally connect to the internet, traditional databases would overwrite one change with the other. A CRDT mathematically merges them: the final transaction will be $60 *and* categorized as "Groceries". 

### 4. Real-Time Multiplayer Experience
If you share an account with a partner, changes they make on their phone will magically pop up on your laptop in real-time, just like Google Docs.

### 5. Backend Independence (Eventually)
While you need a server to relay the messages, the heavy lifting of business logic happens entirely on the client. This makes your backend much simpler (it's mostly just a message broker).

---

## 📉 The Cons (Why everyone doesn't do this)

### 1. Extreme Architectural Complexity
You can no longer just run `UPDATE transactions SET amount = 60 WHERE id = 1`. 
Instead, your database must store *events* or *tombstones*. Every row in your database needs extra metadata (like a logical clock or a vector clock) to track *when* and *where* a change happened.

### 2. The Entire App Needs a Rewrite
Dexie.js is a great wrapper for IndexedDB, but it doesn't support CRDTs out of the box. 
To implement this, you have to rip out Dexie and replace it with a specialized local-first database engine like **PowerSync**, **ElectricSQL**, **RxDB**, or **Yjs**.

### 3. "Ever-Growing" Database State
Because CRDTs need to know history to resolve conflicts, you can never truly "delete" data. If you delete a transaction, the CRDT creates a "tombstone" (a marker saying "this was deleted"). Over years of usage, your local database size will constantly grow, requiring complex "compaction" or "garbage collection" strategies.

### 4. Schema Migration Nightmares
Changing the shape of your data (e.g., adding a new required column to a table) is incredibly hard when different devices might be offline running an older version of your app. You have to write backwards-compatible schemas very carefully.

### 5. Initial Load Time (Cold Start)
When you log in on a brand new laptop, the app has to download the *entire* state of your database from the sync server before it is fully ready to act as a local-first node. For massive datasets, this initial sync can take several seconds.

---

## 🛠️ The Tech Stack needed to achieve this

If you wish to proceed with this integration on Subtrack, we will need to adopt the following stack to replace Dexie:

1.  **Sync Engine (Client)**: `@powersync/web` or `rxdb`. (We will likely use PowerSync as it provides a local SQLite database compiled to WebAssembly, which is faster and more reliable than raw IndexedDB).
2.  **Sync Engine (Server)**: The PowerSync Cloud Service (or self-hosted PowerSync container).
3.  **Source of Truth Database**: Supabase (PostgreSQL).
4.  **Authentication**: Supabase Auth (We need users in order to securely sync data between their specific devices).

## 🚀 Next Steps
If you are ready to proceed with integrating CRDTs into Subtrack, the immediate first step is to set up a **Supabase** project and a **PowerSync** instance to act as our real-time synchronization backend.
