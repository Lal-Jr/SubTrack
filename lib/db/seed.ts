import { db } from '@/lib/db';
import { todayUtc } from '@/lib/subscriptions/schedule';
import { loadSampleData } from './sample';
import { settingsStore } from './settings';

const SEEDED_KEY = 'sample_seeded';
let running: Promise<void> | null = null;

/**
 * On the very first launch of an empty app, adds the sample subscriptions so the dashboard has something to show.
 * It runs once per device: the flag is set before anything is written, so removing the samples, deleting all
 * data, or importing your own subscriptions never brings them back. An app that already has data is left alone.
 */
export function seedSampleOnFirstRun(): Promise<void> {
    running ??= (async () => {
        if (await settingsStore.get(SEEDED_KEY)) return;
        await settingsStore.set(SEEDED_KEY, '1');
        const row = await db.getOptional<{ c: number }>('SELECT COUNT(*) AS c FROM subscriptions');
        if ((row?.c ?? 0) === 0) await loadSampleData(todayUtc());
    })();
    return running;
}
