import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import { AppSchema } from './schema';

/**
 * The app's local SQLite database (wa-sqlite on OPFS). Always present and fully usable
 * offline. It is never connected to a backend here; see lib/sync for the opt-in sync.
 */
export const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
        dbFilename: 'subscriptions.db',
        worker: '/powersync/@powersync/worker/WASQLiteDB.umd.js',
        vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    }),
});
