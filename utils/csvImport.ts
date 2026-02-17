import Papa from 'papaparse';
import db, { Transaction } from '../db/schema';

export type CSVRow = Record<string, string>;

export function parseCSV(file: File): Promise<{ rows: CSVRow[]; fields: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as any[]).map(r => r as CSVRow);
        const fields = results.meta.fields || [];
        resolve({ rows, fields });
      },
      error: reject
    });
  });
}

export function buildTransactionsFromRows(
  rows: CSVRow[],
  mapping: {
    date?: string;
    description?: string;
    amount?: string;
    debit?: string;
    credit?: string;
    category?: string;
    account?: string;
  }
): Transaction[] {
  return rows
    .map((row, i) => {
      const date = mapping.date ? row[mapping.date] : '';
      const description = mapping.description ? row[mapping.description] : '';
      const amountRaw = mapping.amount ? row[mapping.amount] : '';
      const debitRaw = mapping.debit ? row[mapping.debit] : '';
      const creditRaw = mapping.credit ? row[mapping.credit] : '';
      const amount = parseAmount(amountRaw, debitRaw, creditRaw);
      const category = mapping.category ? row[mapping.category] : '';
      const account = mapping.account ? row[mapping.account] : '';
      return {
        id: `${date}-${description}-${i}`,
        date: date || '',
        description: description || '',
        amount,
        category: category || '',
        account: account || ''
      } as Transaction;
    })
    .filter(tx => tx.date && tx.description && !isNaN(tx.amount));
}

export async function importTransactions(transactions: Transaction[]) {
  const existing = await db.transactions.toArray();
  const deduped = transactions.filter(tx => !existing.some(e => e.date === tx.date && e.amount === tx.amount && e.description === tx.description));
  await db.transactions.bulkAdd(deduped);
  return deduped.length;
}

function parseAmount(amountRaw: string, debitRaw: string, creditRaw: string) {
  const toNum = (v: string) => parseFloat((v || '').replace(/[^0-9.-]+/g, ''));
  if (amountRaw) return toNum(amountRaw);
  if (debitRaw) return -Math.abs(toNum(debitRaw));
  if (creditRaw) return Math.abs(toNum(creditRaw));
  return 0;
}
