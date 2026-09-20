export type SyncState = 'off' | 'signed-out' | 'connecting' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
    state: SyncState;
    lastSyncedAt?: Date;
    error?: string;
}

/**
 * Seam between the app and any cloud backend. The app only ever talks to this interface,
 * so local-only users never load backend code.
 */
export interface SyncProvider {
    readonly id: string;
    /** False when the backend is not configured for this build (e.g. missing env keys). */
    isAvailable(): boolean;
    getStatus(): SyncStatus;
    /** Starts syncing. Rejects if the user is not signed in. */
    enable(): Promise<void>;
    /** Stops syncing. Local data is kept untouched. */
    disable(): Promise<void>;
}
