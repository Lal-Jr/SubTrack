import { Transaction, Subscription } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

function normalizeDesc(desc: string) {
  return desc.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const candidates: { [key: string]: Transaction[] } = {};
  for (const tx of transactions) {
    if (tx.amount < 0) {
      const key = normalizeDesc(tx.description);
      if (!candidates[key]) candidates[key] = [];
      candidates[key].push(tx);
    }
  }
  const subs: Subscription[] = [];
  Object.values(candidates).forEach(group => {
    if (group.length < 2) return;
    group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const intervals = group.slice(1).map((tx, i) => {
      const prev = group[i];
      return Math.abs(new Date(tx.date).getTime() - new Date(prev.date).getTime());
    });
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const avgAmount = Math.abs(group.reduce((a, b) => a + b.amount, 0) / group.length);
    if (avgInterval > monthMs * 0.8 && avgInterval < monthMs * 1.2) {
      subs.push({
        id: uuidv4(),
        name: group[0].description,
        avgAmount,
        nextRenewal: new Date(new Date(group[group.length - 1].date).getTime() + avgInterval).toISOString().slice(0, 10),
        lastCharged: group[group.length - 1].date,
        active: true,
        confidence: 0.9
      });
    } else if (avgInterval > yearMs * 0.8 && avgInterval < yearMs * 1.2) {
      subs.push({
        id: uuidv4(),
        name: group[0].description,
        avgAmount,
        nextRenewal: new Date(new Date(group[group.length - 1].date).getTime() + avgInterval).toISOString().slice(0, 10),
        lastCharged: group[group.length - 1].date,
        active: true,
        confidence: 0.7
      });
    }
  });
  return subs;
}
