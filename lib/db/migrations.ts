/**
 * Versioned data migrations. Additive schema changes (new tables/columns) are applied
 * automatically by PowerSync from AppSchema; migrations here are for data transforms
 * that must run once per device. The applied version is kept in the local settings table.
 */
export interface SettingsStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
}

export interface Migration {
    version: number;
    description: string;
    up(): Promise<void>;
}

export const SCHEMA_VERSION_KEY = 'schema_version';

/** v1 is the baseline: existing databases (subscriptions, profiles) are adopted as-is. */
export const migrations: Migration[] = [
    { version: 1, description: 'baseline', up: async () => {} },
];

/** Runs pending migrations in order, recording each version as it completes. Returns versions applied. */
export async function runMigrations(store: SettingsStore, list: Migration[] = migrations): Promise<number[]> {
    const current = Number((await store.get(SCHEMA_VERSION_KEY)) ?? 0);
    const applied: number[] = [];
    for (const m of [...list].sort((a, b) => a.version - b.version)) {
        if (m.version <= current) continue;
        await m.up();
        await store.set(SCHEMA_VERSION_KEY, String(m.version));
        applied.push(m.version);
    }
    return applied;
}
