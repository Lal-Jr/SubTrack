'use client';

import { useEffect, useState } from 'react';
import db, { Subscription, Transaction } from '../../db/schema';
import { detectSubscriptions } from '../../utils/subscriptionDetection';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = async () => {
    const [subs, txs] = await Promise.all([
      db.subscriptions.toArray(),
      db.transactions.toArray(),
    ]);
    setSubscriptions(subs);
    setTransactions(txs);
  };

  useEffect(() => {
    load();
  }, []);

  const detect = async () => {
    const detected = detectSubscriptions(transactions);
    await db.subscriptions.clear();
    await db.subscriptions.bulkAdd(detected);
    setSubscriptions(detected);
  };

  const updateSub = async (sub: Subscription) => {
    await db.subscriptions.put(sub);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Recurring</p>
          <h1 className="text-3xl font-semibold gradient-title">Subscriptions</h1>
        </div>
        <button className="btn" onClick={detect}>Re-Detect</button>
      </div>

      <div className="card space-y-3">
        {subscriptions.length ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.6fr] gap-2 text-xs uppercase tracking-wide text-slate-500">
              <span>Name</span>
              <span>Last / Next</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            <div className="soft-divider" />
            {subscriptions.map(sub => (
              <div key={sub.id} className="grid grid-cols-[1.4fr_1fr_1fr_0.6fr] items-center gap-2">
                <div>
                  <div className="font-medium">{sub.name}</div>
                  <div className="text-xs text-slate-500">Confidence: {(sub.confidence || 0).toFixed(2)}</div>
                </div>
                <div className="text-xs text-slate-500">{sub.lastCharged} → {sub.nextRenewal}</div>
                <input
                  className="input"
                  type="number"
                  value={sub.avgAmount}
                  onChange={e => updateSub({ ...sub, avgAmount: Number(e.target.value) })}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={sub.active}
                    onChange={e => updateSub({ ...sub, active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No subscriptions detected yet.</p>
        )}
      </div>
    </div>
  );
}
