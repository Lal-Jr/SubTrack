import { Schema, Table, column } from '@powersync/web';

/** Tables that hold user data. Backed up, and synced when cloud sync is enabled. */
export const USER_TABLES = ['subscriptions', 'profiles', 'transactions'] as const;
export type UserTable = (typeof USER_TABLES)[number];

export const AppSchema = new Schema({
    subscriptions: new Table({
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
        category: column.text,
        tags: column.text,
        is_variable: column.integer,
    }),
    profiles: new Table({
        name: column.text,
        monthly_income: column.real,
        currency: column.text,
        last_csv_upload: column.integer,
        created_at: column.integer,
        updated_at: column.integer,
    }),
    // Imported bank transactions, kept so detection can be re-run without re-importing.
    // amount_minor is an integer in minor units (paise/cents), negative = debit.
    transactions: new Table(
        {
            date: column.text, // ISO 8601
            description: column.text,
            amount_minor: column.integer,
            currency: column.text,
            merchant: column.text,
            category: column.text,
            import_id: column.text,
            dedupe_key: column.text,
            created_at: column.integer,
        },
        { indexes: { by_date: ['date'], by_dedupe: ['dedupe_key'] } },
    ),
    // Device-local key/value store (schema version, sync preference). Never synced or backed up.
    settings: new Table({ value: column.text }, { localOnly: true }),
});
