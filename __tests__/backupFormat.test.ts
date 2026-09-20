import { describe, test, expect } from 'vitest';
import { buildBackup, parseBackup } from '../lib/db/backupFormat';

const empty = { subscriptions: [], profiles: [], transactions: [] };

describe('backup format', () => {
  test('round-trips', () => {
    const tables = { ...empty, subscriptions: [{ id: 'a', name: 'Netflix', amount: 199, active: 1, tags: null }] };
    const parsed = parseBackup(JSON.stringify(buildBackup(tables)));
    expect(parsed.tables.subscriptions[0].name).toBe('Netflix');
  });
  test('missing tables default to empty', () => {
    const parsed = parseBackup(JSON.stringify({ format: 'subtrack-backup', version: 1, exportedAt: '', tables: {} }));
    expect(parsed.tables.transactions).toEqual([]);
  });
  test('rejects non-JSON, wrong format and newer versions', () => {
    expect(() => parseBackup('nope')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"format":"x"}')).toThrow(/not a Subtrack backup/);
    expect(() => parseBackup(JSON.stringify({ format: 'subtrack-backup', version: 99, tables: {} }))).toThrow(/newer version/);
  });
  test('rejects rows without id and unsafe column names', () => {
    const bad = (rows: unknown[]) => JSON.stringify({ format: 'subtrack-backup', version: 1, tables: { profiles: rows } });
    expect(() => parseBackup(bad([{ name: 'x' }]))).toThrow(/without an id/);
    expect(() => parseBackup(bad([{ id: '1', 'name); DROP TABLE profiles;--': 'x' }]))).toThrow(/invalid column/);
  });
});
