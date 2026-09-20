import { db } from '@/lib/db';

export interface SubscriptionInput {
    name: string;
    amount: number;
    currency: string;
    intervalCount: number;
    intervalUnit: string;
    nextChargeDate: string;
    category: string | null;
    isVariable: boolean;
}

export async function createSubscription(input: SubscriptionInput): Promise<void> {
    await db.waitForReady();
    const now = Date.now();
    await db.execute(
        `INSERT INTO subscriptions
           (id, name, amount, currency, interval_count, interval_unit, next_charge_date, source, confidence, active, created_at, updated_at, category, is_variable)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 1, 1, ?, ?, ?, ?)`,
        [crypto.randomUUID(), input.name, input.amount, input.currency, input.intervalCount, input.intervalUnit, input.nextChargeDate, now, now, input.category, input.isVariable ? 1 : 0],
    );
}

export async function updateSubscription(id: string, input: SubscriptionInput): Promise<void> {
    await db.waitForReady();
    await db.execute(
        `UPDATE subscriptions SET name = ?, amount = ?, currency = ?, interval_count = ?, interval_unit = ?,
           next_charge_date = ?, category = ?, is_variable = ?, updated_at = ? WHERE id = ?`,
        [input.name, input.amount, input.currency, input.intervalCount, input.intervalUnit, input.nextChargeDate, input.category, input.isVariable ? 1 : 0, Date.now(), id],
    );
}

export async function setActive(id: string, active: boolean): Promise<void> {
    await db.waitForReady();
    await db.execute('UPDATE subscriptions SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, Date.now(), id]);
}

export async function deleteSubscription(id: string): Promise<void> {
    await db.waitForReady();
    await db.execute('DELETE FROM subscriptions WHERE id = ?', [id]);
}
