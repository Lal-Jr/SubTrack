import { db } from '@/lib/db';

export interface ProfileInput {
    name: string;
    monthlyIncome: number | null;
    currency: string;
}

/** Creates the single profile row, or updates it if one exists. */
export async function saveProfile(input: ProfileInput): Promise<void> {
    await db.waitForReady();
    const now = Date.now();
    const existing = await db.getOptional<{ id: string }>('SELECT id FROM profiles LIMIT 1');
    if (existing) {
        await db.execute('UPDATE profiles SET name = ?, monthly_income = ?, currency = ?, updated_at = ? WHERE id = ?', [
            input.name, input.monthlyIncome, input.currency, now, existing.id,
        ]);
    } else {
        await db.execute('INSERT INTO profiles (id, name, monthly_income, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
            crypto.randomUUID(), input.name, input.monthlyIncome, input.currency, now, now,
        ]);
    }
}
