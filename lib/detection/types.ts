import type { Minor } from '@/types/money';
import type { MerchantRule } from './merchants';

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/** confirmed: 3+ regular charges. probable: 2 regular charges. possible: 1 charge from a known subscription merchant. */
export type Status = 'confirmed' | 'probable' | 'possible';

export interface Transaction {
    /** ISO date (YYYY-MM-DD, or a full ISO timestamp; only the date part is used). */
    date: string;
    description: string;
    /** Minor units (paise/cents). Negative = debit, positive = credit. */
    amountMinor: Minor;
}

export interface DetectedSubscription {
    /** Stable grouping key, e.g. "netflix". */
    key: string;
    /** Display name, e.g. "Netflix". */
    merchant: string;
    category: string | null;
    frequency: Frequency;
    status: Status;
    occurrences: number;
    /** What the next charge is expected to be. The average of recent charges when the amount varies. */
    amountMinor: Minor;
    priceHistoryMinor: Minor[];
    priceChanged: boolean;
    isVariable: boolean;
    firstDate: string;
    lastDate: string;
    /** Null when the subscription looks lapsed. */
    nextDate: string | null;
    /** False when no charge has been seen for well over one billing cycle. */
    active: boolean;
    annualCostMinor: Minor;
    /** 0..1 */
    confidence: number;
}

export interface DetectionOptions {
    /** "Today", for deterministic results. Defaults to now. */
    asOf?: Date;
    /** Extra merchant rules; they take priority over the built-in list. */
    merchants?: MerchantRule[];
}
