import { db } from './index';
import type { SettingsStore } from './migrations';

export const settingsStore: SettingsStore = {
    async get(key) {
        const row = await db.getOptional<{ value: string | null }>('SELECT value FROM settings WHERE id = ?', [key]);
        return row?.value ?? null;
    },
    async set(key, value) {
        await db.execute('INSERT OR REPLACE INTO settings (id, value) VALUES (?, ?)', [key, value]);
    },
};
