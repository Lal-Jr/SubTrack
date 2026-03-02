import { AbstractPowerSyncDatabase, PowerSyncBackendConnector, UpdateType } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Only init client if real URL exists to prevent URL constructor crashes during Next.js SSG
const isValidUrl = supabaseUrl.startsWith('http');
export const supabase = createClient(isValidUrl ? supabaseUrl : "https://placeholder.supabase.co", supabaseAnonKey);

export class SupabaseConnector implements PowerSyncBackendConnector {

    constructor() {
        this.fetchCredentials = this.fetchCredentials.bind(this);
        this.uploadData = this.uploadData.bind(this);
    }

    async fetchCredentials() {
        // Note: In a real app with User Auth, you get the session token here.
        // For Subtrack (a personal offline-first tool), we use the Anon Key for simple sync
        // assuming RLS is disabled OR the user relies on Anonymous Sessions.
        const { data: { session }, error } = await supabase.auth.getSession();

        let token = supabaseAnonKey;

        if (session) {
            token = session.access_token;
        }

        return {
            endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL || "",
            token: token,
            expiresAt: session ? new Date(session.expires_at! * 1000) : undefined
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;

        try {
            for (const op of transaction.crud) {
                let table = op.table;
                switch (op.op) {
                    case UpdateType.PUT:
                        await supabase.from(table).upsert({ ...op.opData, id: op.id });
                        break;
                    case UpdateType.PATCH:
                        await supabase.from(table).update(op.opData).eq('id', op.id);
                        break;
                    case UpdateType.DELETE:
                        await supabase.from(table).delete().eq('id', op.id);
                        break;
                }
            }
            await transaction.complete();
        } catch (e: any) {
            console.error('Error uploading data to Supabase:', e);
            throw e; // Throw so PowerSync retries later
        }
    }
}
