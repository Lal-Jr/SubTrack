import Papa from 'papaparse';
import { parseAmount } from './amount';
import { detectDateOrder, parseDate } from './date';
import type { ColumnMapping, CsvOptions, DateOrder, ParseResult, ParsedTransaction } from './types';

export type Grid = string[][];

export function readGrid(text: string): Grid {
    const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true });
    return result.data.map((row) => row.map((c) => (c ?? '').trim()));
}

// Header cell -> role. Order matters: `type` must be tested before `debit`/`credit`
// so that a "Debit/Credit" flag column is not mistaken for the debit amount column.
const ROLES: { role: keyof ColumnMapping; test: RegExp }[] = [
    { role: 'type', test: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|credit\s*\/\s*debit|(transaction\s*)?type|txn\s*type)$/ },
    { role: 'debit', test: /^(withdrawals?|debits?|dr|paid out|money out|withdrawal amt\.?|debit amount|withdrawal amount)$/ },
    { role: 'credit', test: /^(deposits?|credits?|cr|paid in|money in|deposit amt\.?|credit amount|deposit amount)$/ },
    { role: 'amount', test: /^(amount|transaction amount|txn amount|amount\s*\(.*\))$/ },
    { role: 'description', test: /^(narration|description|particulars|details|transaction details|transaction description|remarks|memo|payee|merchant|name)$/ },
    { role: 'date', test: /^((txn|transaction|posting|booking|trans)\.?\s*)?date$/ },
];

/** Assigns each header cell a role. The first cell for a role wins, so "Date" beats "Value Date". */
function rolesForRow(row: string[]): Partial<ColumnMapping> {
    const found: Partial<ColumnMapping> = {};
    row.forEach((cell, i) => {
        const c = cell.toLowerCase().replace(/\s+/g, ' ').trim();
        for (const { role, test } of ROLES) {
            if (test.test(c)) {
                if (found[role] === undefined) found[role] = i;
                break;
            }
        }
    });
    return found;
}

const isComplete = (m: Partial<ColumnMapping>): m is ColumnMapping =>
    m.date !== undefined && m.description !== undefined && (m.amount !== undefined || (m.debit !== undefined && m.credit !== undefined));

export interface Detection {
    headerRow: number;
    /** Null when no header row could be recognised; the user must map columns by hand. */
    mapping: ColumnMapping | null;
    dateOrder: DateOrder;
    dateOrderAmbiguous: boolean;
}

/** Finds the header row (banks often put account details above it) and works out the column roles. */
export function detectCsv(grid: Grid): Detection {
    let headerRow = 0;
    let mapping: ColumnMapping | null = null;
    for (let i = 0; i < Math.min(grid.length, 30); i++) {
        const found = rolesForRow(grid[i]);
        if (isComplete(found)) {
            headerRow = i;
            mapping = found;
            break;
        }
    }
    const dateSamples = mapping ? grid.slice(headerRow + 1, headerRow + 200).map((r) => r[mapping!.date] ?? '') : [];
    const { order, ambiguous } = detectDateOrder(dateSamples);
    return { headerRow, mapping, dateOrder: order, dateOrderAmbiguous: ambiguous };
}

const DEBIT_FLAG = /^(dr|debit|d|withdrawal|w)\.?$/i;
const CREDIT_FLAG = /^(cr|credit|c|deposit)\.?$/i;

export function extractCsv(grid: Grid, opts: CsvOptions): ParseResult {
    const { mapping: m, dateOrder, positiveIsDebit } = opts;
    const transactions: ParsedTransaction[] = [];
    let badDates = 0;
    let badAmounts = 0;

    for (const row of grid.slice(opts.headerRow + 1)) {
        const rawDate = row[m.date] ?? '';
        const date = parseDate(rawDate, dateOrder);
        if (!date) {
            // Footers and blank-ish rows are expected; only count rows that had something in the date cell.
            if (rawDate.trim()) badDates++;
            continue;
        }

        let amount: number | null = null;
        if (m.debit !== undefined && m.credit !== undefined && m.amount === undefined) {
            const debit = parseAmount(row[m.debit]);
            const credit = parseAmount(row[m.credit]);
            if (debit) amount = -Math.abs(debit);
            else if (credit) amount = Math.abs(credit);
        } else if (m.amount !== undefined) {
            const raw = parseAmount(row[m.amount]);
            if (raw !== null) {
                const flag = m.type !== undefined ? (row[m.type] ?? '').trim() : '';
                if (DEBIT_FLAG.test(flag)) amount = -Math.abs(raw);
                else if (CREDIT_FLAG.test(flag)) amount = Math.abs(raw);
                else amount = positiveIsDebit ? -raw : raw;
            }
        }
        if (!amount) {
            badAmounts++;
            continue;
        }
        transactions.push({ date, description: (row[m.description] ?? '').trim(), amountMinor: amount });
    }

    const warnings: string[] = [];
    if (badDates) warnings.push(`${badDates} row(s) skipped because the date could not be read.`);
    if (badAmounts) warnings.push(`${badAmounts} row(s) skipped because they had no amount.`);
    return { transactions, warnings };
}
