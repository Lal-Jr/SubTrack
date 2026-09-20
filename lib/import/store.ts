import { db } from '@/lib/db';
import { normalizeMerchant } from '@/lib/detection';
import type { ParsedTransaction } from './types';

export interface ExistingData {
    /** Dedupe keys of every stored transaction. */
    keys: Set<string>;
    transactions: ParsedTransaction[];
    /** Normalized merchant keys of subscriptions already tracked (manual or imported). */
    trackedMerchants: Set<string>;
}

export async function loadExisting(): Promise<ExistingData> {
    await db.waitForReady();
    const rows = await db.getAll<{ date: string; description: string; amount_minor: number; dedupe_key: string }>(
        'SELECT date, description, amount_minor, dedupe_key FROM transactions',
    );
    const subs = await db.getAll<{ name: string }>('SELECT name FROM subscriptions');
    return {
        keys: new Set(rows.map((r) => r.dedupe_key)),
        transactions: rows.map((r) => ({ date: r.date, description: r.description, amountMinor: r.amount_minor })),
        trackedMerchants: new Set(subs.map((s) => normalizeMerchant(s.name).key)),
    };
}

export interface NewSubscription {
    name: string;
    /** Major units, matching the subscriptions table. */
    amount: number;
    currency: string;
    intervalCount: number;
    intervalUnit: string;
    lastChargeDate: string;
    nextChargeDate: string | null;
    confidence: number;
    isVariable: boolean;
    active: boolean;
    category: string | null;
}

/** Saves new transactions and chosen subscriptions in one transaction: all of it, or none of it. */
export async function saveImport(input: {
    transactions: { t: ParsedTransaction; key: string }[];
    subscriptions: NewSubscription[];
    currency: string;
}): Promise<void> {
    await db.waitForReady();
    const now = Date.now();
    const importId = crypto.randomUUID();

    await db.writeTransaction(async (tx) => {
        for (const { t, key } of input.transactions) {
            await tx.execute(
                `INSERT INTO transactions (id, date, description, amount_minor, currency, merchant, category, import_id, dedupe_key, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
                [crypto.randomUUID(), t.date, t.description, t.amountMinor, input.currency, normalizeMerchant(t.description).name, importId, key, now],
            );
        }
        for (const s of input.subscriptions) {
            await tx.execute(
                `INSERT INTO subscriptions
                   (id, name, amount, currency, interval_count, interval_unit, last_charge_date, next_charge_date, source, confidence, active, created_at, updated_at, category, is_variable)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'statement_import', ?, ?, ?, ?, ?, ?)`,
                [crypto.randomUUID(), s.name, s.amount, s.currency, s.intervalCount, s.intervalUnit, s.lastChargeDate, s.nextChargeDate, s.confidence, s.active ? 1 : 0, now, now, s.category, s.isVariable ? 1 : 0],
            );
        }
        await tx.execute('UPDATE profiles SET last_csv_upload = ?, updated_at = ?', [now, now]);
    });
}
