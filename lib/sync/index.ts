import { noopProvider } from './noop';
import type { SyncProvider } from './types';

export type { SyncProvider, SyncStatus, SyncState } from './types';

/** True when the build has the keys needed for cloud sync, so the UI can hide the option otherwise. */
export const isCloudSyncConfigured = () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_POWERSYNC_URL);

/** Loads the Supabase provider on demand, so its code is only fetched when the user opts in. */
export async function loadSyncProvider(): Promise<SyncProvider> {
    if (!isCloudSyncConfigured()) return noopProvider;
    const { supabaseProvider } = await import('./supabase/provider');
    return supabaseProvider;
}
