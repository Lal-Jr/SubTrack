import { Transaction, Subscription } from '../db/schema';

export function forecastBalance({
  transactions,
  subscriptions,
  months = 6
}: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  months?: number;
}): { date: string; balance: number }[] {
  const now = new Date();
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let balance = sorted.reduce((acc, tx) => acc + tx.amount, 0);
  const monthlyIncome = avgMonthly(sorted, true);
  const monthlyExpense = avgMonthly(sorted, false);
  const monthlySubs = subscriptions.filter(s => s.active).reduce((a, s) => a + s.avgAmount, 0);
  const forecast: { date: string; balance: number }[] = [];
  for (let i = 1; i <= months; i++) {
    balance += monthlyIncome - monthlyExpense - monthlySubs;
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    forecast.push({ date: date.toISOString().slice(0, 10), balance: Math.round(balance * 100) / 100 });
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
