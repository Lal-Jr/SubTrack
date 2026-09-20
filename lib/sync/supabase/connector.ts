import { AbstractPowerSyncDatabase, PowerSyncBackendConnector, UpdateType } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export class NotSignedInError extends Error {
    constructor() {
        super('Sign in to enable cloud sync.');
    }
}

// Postgres codes for errors a retry can never fix (constraint/type/permission problems).
const FATAL_PG_CODES = [/^22...$/, /^23...$/, '42501'];
const isFatal = (code?: string) =>
    !!code && FATAL_PG_CODES.some((p) => (typeof p === 'string' ? p === code : p.test(code)));

export class SupabaseConnector implements PowerSyncBackendConnector {
    async fetchCredentials() {
        // Never fall back to the anon key: sync requires a signed-in user so RLS can scope rows.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new NotSignedInError();
        return {
            endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
            token: session.access_token,
            expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;

        for (const op of transaction.crud) {
            const table = supabase.from(op.table);
            const result =
                op.op === UpdateType.PUT
                    ? await table.upsert({ ...op.opData, id: op.id })
                    : op.op === UpdateType.PATCH
                      ? await table.update(op.opData ?? {}).eq('id', op.id)
                      : await table.delete().eq('id', op.id);
            // Fatal errors are dropped so one bad row cannot block the queue forever;
            // anything else throws so PowerSync retries.
            if (result.error && !isFatal(result.error.code)) throw result.error;
            if (result.error) console.error('Dropping unsyncable change:', result.error);
        }
        await transaction.complete();
    }
}
