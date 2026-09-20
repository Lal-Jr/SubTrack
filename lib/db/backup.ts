import { db } from './index';
import { USER_TABLES, type UserTable } from './schema';
import { buildBackup, parseBackup, type BackupFile, type Row } from './backupFormat';

export async function exportBackup(): Promise<BackupFile> {
    const tables = {} as Record<UserTable, Row[]>;
    for (const name of USER_TABLES) {
        tables[name] = await db.getAll<Row>(`SELECT * FROM ${name}`);
    }
    return buildBackup(tables);
}

export type ImportMode = 'replace' | 'merge';

/**
 * Restores a backup inside one transaction. "replace" clears user tables first;
 * "merge" upserts by id and leaves other rows alone.
 */
export async function importBackup(text: string, mode: ImportMode): Promise<Record<UserTable, number>> {
    const backup = parseBackup(text);
    const counts = {} as Record<UserTable, number>;
    await db.writeTransaction(async (tx) => {
        for (const name of USER_TABLES) {
            if (mode === 'replace') await tx.execute(`DELETE FROM ${name}`);
            for (const row of backup.tables[name]) {
                const cols = Object.keys(row);
                await tx.execute(
                    `INSERT OR REPLACE INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                    cols.map((c) => row[c]),
                );
            }
            counts[name] = backup.tables[name].length;
        }
    });
    return counts;
}

/** Triggers a browser download of the current data as a JSON file. */
export async function downloadBackup(): Promise<void> {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtrack-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Deletes every row of user data on this device. Settings (e.g. schema version) are kept. */
export async function clearAllData(): Promise<void> {
    await db.writeTransaction(async (tx) => {
        for (const name of USER_TABLES) await tx.execute(`DELETE FROM ${name}`);
    });
}
