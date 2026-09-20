import { describe, test, expect } from 'vitest';
import { runMigrations, SCHEMA_VERSION_KEY, type Migration, type SettingsStore } from '../lib/db/migrations';

function memoryStore(initial: Record<string, string> = {}): SettingsStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, get: async (k) => data[k] ?? null, set: async (k, v) => void (data[k] = v) };
}

describe('runMigrations', () => {
  test('applies pending migrations in version order and records the version', async () => {
    const order: number[] = [];
    const list: Migration[] = [2, 1, 3].map((version) => ({ version, description: '', up: async () => void order.push(version) }));
    const store = memoryStore();
    expect(await runMigrations(store, list)).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    expect(store.data[SCHEMA_VERSION_KEY]).toBe('3');
  });

  test('skips already-applied versions', async () => {
    const ran: number[] = [];
    const list: Migration[] = [1, 2].map((version) => ({ version, description: '', up: async () => void ran.push(version) }));
    expect(await runMigrations(memoryStore({ [SCHEMA_VERSION_KEY]: '1' }), list)).toEqual([2]);
    expect(ran).toEqual([2]);
  });

  test('a failing migration does not advance the version', async () => {
    const store = memoryStore({ [SCHEMA_VERSION_KEY]: '1' });
    const list: Migration[] = [{ version: 2, description: '', up: async () => { throw new Error('boom'); } }];
    await expect(runMigrations(store, list)).rejects.toThrow('boom');
    expect(store.data[SCHEMA_VERSION_KEY]).toBe('1');
  });
});
