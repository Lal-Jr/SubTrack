import { Transaction, Subscription } from '../db/schema';

export function forecastExpenses({
  transactions,
  subscriptions,
  months = 6,
}: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  months?: number;
}): { date: string; expense: number }[] {
  const now = new Date();
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const monthlyExpense = avgMonthly(sorted, false);
  const monthlySubs = subscriptions.filter(s => s.active).reduce((a, s) => a + s.avgAmount, 0);
  const forecast: { date: string; expense: number }[] = [];
  for (let i = 1; i <= months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const expense = monthlyExpense + monthlySubs;
    forecast.push({ date: date.toISOString().slice(0, 10), expense: Math.round(expense * 100) / 100 });
  }
  return forecast;
}

function avgMonthly(transactions: Transaction[], income: boolean) {
  const filtered = transactions.filter(tx => (income ? tx.amount > 0 : tx.amount < 0));
  if (!filtered.length) return 0;
  const months = new Set(filtered.map(tx => tx.date.slice(0, 7))).size;
  const total = filtered.reduce((a, b) => a + Math.abs(b.amount), 0);
  return months ? total / months : 0;
}
