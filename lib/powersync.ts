import { PowerSyncDatabase, Schema, Table, column, WASQLiteOpenFactory, WASQLiteVFS } from "@powersync/web";

const AppSchema = new Schema({
    subscriptions: new Table({
        id: column.text,
        name: column.text,
        amount: column.real,
        currency: column.text,
        interval_count: column.integer,
        interval_unit: column.text,
        last_charge_date: column.text,
        next_charge_date: column.text,
        source: column.text,
        confidence: column.real,
        active: column.integer,
        created_at: column.integer,
        updated_at: column.integer,
    }),
    profiles: new Table({
        id: column.text,
        name: column.text,
        monthly_income: column.real,
        currency: column.text,
        created_at: column.integer,
        updated_at: column.integer,
    }),
});

export const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
        dbFilename: "subscriptions.db",
        worker: "/powersync/@powersync/worker/WASQLiteDB.umd.js",
        vfs: WASQLiteVFS.OPFSCoopSyncVFS
    }),
});