import db, { Rule, Transaction } from '../db/schema';

export function autoCategorize(transaction: Transaction, rules: Rule[]): string {
  const desc = transaction.description.toLowerCase();
  for (const rule of rules) {
    if (desc.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  return 'Uncategorized';
}

export async function categorizeTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const rules = await db.rules.toArray();
  return transactions.map(tx => ({
    ...tx,
    category: tx.category || autoCategorize(tx, rules)
  }));
}
