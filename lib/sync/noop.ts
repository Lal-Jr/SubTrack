import type { SyncProvider, SyncStatus } from './types';

/** Default provider: the app is local-only and nothing leaves the device. */
export const noopProvider: SyncProvider = {
    id: 'none',
    isAvailable: () => false,
    getStatus: (): SyncStatus => ({ state: 'off' }),
    async enable() {
        throw new Error('Cloud sync is not available in this build.');
    },
    async disable() {},
};
