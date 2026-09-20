import { USER_TABLES, type UserTable } from './schema';

export const BACKUP_FORMAT = 'subtrack-backup';
export const BACKUP_VERSION = 1;

export type Row = Record<string, string | number | null>;

export interface BackupFile {
    format: typeof BACKUP_FORMAT;
    version: number;
    exportedAt: string;
    tables: Record<UserTable, Row[]>;
}

export function buildBackup(tables: Record<UserTable, Row[]>, now = new Date()): BackupFile {
    return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), tables };
}

const isScalar = (v: unknown) => v === null || typeof v === 'string' || typeof v === 'number';

/** Validates untrusted JSON text and returns a BackupFile, throwing a readable error otherwise. */
export function parseBackup(text: string): BackupFile {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Backup file is not valid JSON.');
    }
    const file = data as Partial<BackupFile> | null;
    if (!file || typeof file !== 'object' || file.format !== BACKUP_FORMAT) {
        throw new Error('This is not a Subtrack backup file.');
    }
    if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
        throw new Error('This backup was made by a newer version of Subtrack.');
    }
    const tables = {} as Record<UserTable, Row[]>;
    for (const name of USER_TABLES) {
        const rows = file.tables?.[name] ?? [];
        if (!Array.isArray(rows)) throw new Error(`Backup table "${name}" is malformed.`);
        for (const row of rows) {
            if (!row || typeof row !== 'object' || typeof (row as Row).id !== 'string') {
                throw new Error(`Backup table "${name}" has a row without an id.`);
            }
            const r = row as Row;
            for (const [col, v] of Object.entries(r)) {
                // Column names are interpolated into SQL on import, so restrict them.
                if (!/^[a-z_][a-z0-9_]*$/.test(col) || !isScalar(v)) {
                    throw new Error(`Backup table "${name}" has an invalid column "${col}".`);
                }
            }
        }
        tables[name] = rows as Row[];
    }
    return { format: BACKUP_FORMAT, version: file.version, exportedAt: String(file.exportedAt ?? ''), tables };
}
