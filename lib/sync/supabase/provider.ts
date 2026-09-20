import { db } from '../../db';
import type { SyncProvider, SyncStatus } from '../types';
import { NotSignedInError, SupabaseConnector, supabase } from './connector';

export const supabaseProvider: SyncProvider = {
    id: 'supabase',
    isAvailable: () => true,
    getStatus(): SyncStatus {
        const s = db.currentStatus;
        if (!s.connected && !s.connecting) return { state: 'off' };
        if (s.connecting) return { state: 'connecting' };
        if (s.dataFlowStatus?.uploading || s.dataFlowStatus?.downloading) return { state: 'syncing', lastSyncedAt: s.lastSyncedAt };
        return { state: 'synced', lastSyncedAt: s.lastSyncedAt };
    },
    async enable() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new NotSignedInError();
        await db.connect(new SupabaseConnector());
    },
    async disable() {
        await db.disconnect();
    },
};
