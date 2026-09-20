export type IntervalUnit = 'day' | 'week' | 'month' | 'year';

/** A row of the subscriptions table. Amounts are major units (e.g. 199.00). */
export interface SubscriptionRow {
    id: string;
    name: string;
    amount: number | null;
    currency: string | null;
    interval_count: number | null;
    interval_unit: string | null;
    last_charge_date: string | null;
    next_charge_date: string | null;
    source: string | null;
    confidence: number | null;
    active: number | null;
    category: string | null;
    tags: string | null;
    is_variable: number | null;
}

export const isActive = (s: Pick<SubscriptionRow, 'active'>) => s.active !== 0;
