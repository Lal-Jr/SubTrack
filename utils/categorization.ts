import db, { Rule, Transaction } from '../db/schema';

export function autoCategorize(transaction: Transaction, rules: Rule[]): string {
  const desc = transaction.description.toLowerCase();
  const acct = (transaction.account || '').toLowerCase();
  for (const rule of rules) {
    const keywordMatch = rule.keyword && desc.includes(rule.keyword.toLowerCase());
    const accountMatch = rule.accountKeyword && acct.includes(rule.accountKeyword.toLowerCase());
    if (keywordMatch || accountMatch) {
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
