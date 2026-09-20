import { db } from '@/lib/db';
import { formatDay } from '@/lib/detection/dates';
import { addDays } from '@/lib/detection/dates';

export interface SampleSubscription {
    name: string;
    amount: number;
    intervalCount: number;
    intervalUnit: 'month' | 'year';
    category: string;
    /** Days from today to the next charge, so the sample always looks current. */
    inDays: number;
}

/** A realistic set of subscriptions for trying the app without any personal data. */
export const SAMPLE_SUBSCRIPTIONS: SampleSubscription[] = [
    { name: 'iCloud', amount: 749, intervalCount: 1, intervalUnit: 'month', category: 'Software', inDays: 3 },
    { name: 'YouTube Premium', amount: 195, intervalCount: 1, intervalUnit: 'month', category: 'Entertainment', inDays: 9 },
    { name: 'Google Cloud', amount: 130, intervalCount: 1, intervalUnit: 'month', category: 'Software', inDays: 12 },
    { name: 'Claude', amount: 2399, intervalCount: 1, intervalUnit: 'month', category: 'Software', inDays: 17 },
    { name: 'Netflix', amount: 199, intervalCount: 1, intervalUnit: 'month', category: 'Entertainment', inDays: 21 },
    { name: 'Adobe Lightroom', amount: 4000, intervalCount: 1, intervalUnit: 'year', category: 'Software', inDays: 46 },
];

export const SAMPLE_SOURCE = 'sample';

/** Adds the sample subscriptions (INR), dated relative to `todayMs`. Sample rows are tagged so they can be removed cleanly. */
export async function loadSampleData(todayMs: number): Promise<void> {
    await db.waitForReady();
    const now = Date.now();
    await db.writeTransaction(async (tx) => {
        for (const s of SAMPLE_SUBSCRIPTIONS) {
            await tx.execute(
                `INSERT INTO subscriptions
                   (id, name, amount, currency, interval_count, interval_unit, next_charge_date, source, confidence, active, created_at, updated_at, category, is_variable)
                 VALUES (?, ?, ?, 'INR', ?, ?, ?, ?, 1, 1, ?, ?, ?, 0)`,
                [crypto.randomUUID(), s.name, s.amount, s.intervalCount, s.intervalUnit, formatDay(addDays(todayMs, s.inDays)), SAMPLE_SOURCE, now, now, s.category],
            );
        }
    });
}

export async function clearSampleData(): Promise<void> {
    await db.waitForReady();
    await db.execute('DELETE FROM subscriptions WHERE source = ?', [SAMPLE_SOURCE]);
}
