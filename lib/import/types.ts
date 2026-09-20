import type { Minor } from '@/types/money';

export interface ParsedTransaction {
    /** ISO date, YYYY-MM-DD. */
    date: string;
    description: string;
    /** Minor units. Negative = debit, positive = credit. */
    amountMinor: Minor;
}

export type DateOrder = 'dmy' | 'mdy';

/** Zero-based column indexes into the CSV grid. Either debit+credit, or amount, must be present. */
export interface ColumnMapping {
    date: number;
    description: number;
    debit?: number;
    credit?: number;
    amount?: number;
    /** A column holding Dr/Cr (or Debit/Credit) for each row, used with `amount`. */
    type?: number;
}

export interface CsvOptions {
    headerRow: number;
    mapping: ColumnMapping;
    dateOrder: DateOrder;
    /** Single signed-amount exports: are positive numbers purchases (credit-card style) rather than deposits? */
    positiveIsDebit: boolean;
}

export interface ParseResult {
    transactions: ParsedTransaction[];
    /** Human-readable notes about rows that were skipped or guessed. */
    warnings: string[];
}
