'use client';

import type { SubscriptionRow } from '@/lib/subscriptions/types';
import { useLiveQuery } from './useLiveQuery';

export interface Profile {
    id: string;
    name: string | null;
    monthly_income: number | null;
    currency: string | null;
    last_csv_upload: number | null;
}

export function useSubscriptions() {
    return useLiveQuery<SubscriptionRow>('SELECT * FROM subscriptions ORDER BY name COLLATE NOCASE');
}

export function useProfile() {
    const q = useLiveQuery<Profile>('SELECT id, name, monthly_income, currency, last_csv_upload FROM profiles LIMIT 1');
    return { profile: q.data[0] ?? null, loading: q.loading, currency: q.data[0]?.currency || 'INR' };
}
