'use client';

import { useEffect, useMemo, useState } from 'react';
import db, { Category, Transaction } from '../../db/schema';
import { autoCategorize } from '../../utils/categorization';

const emptyTx: Transaction = {
  id: '',
  date: '',
  description: '',
  amount: 0,
  category: '',
  account: '',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState([] as { id: string; keyword: string; category: string }[]);
  const [form, setForm] = useState<Transaction>(emptyTx);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    const [txs, cats, rulesList] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.categories.toArray(),
      db.rules.toArray(),
    ]);
    setTransactions(txs);
    setCategories(cats);
    setRules(rulesList);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async () => {
    const category = form.category || autoCategorize(form, rules);
    const tx: Transaction = {
      ...form,
      category,
      id: editingId || crypto.randomUUID(),
    };
    if (editingId) await db.transactions.put(tx);
    else await db.transactions.add(tx);
    setForm(emptyTx);
    setEditingId(null);
    load();
  };

  const onEdit = (tx: Transaction) => {
    setForm(tx);
    setEditingId(tx.id);
  };

  const onDelete = async (id: string) => {
    await db.transactions.delete(id);
    load();
  };

  const balance = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Activity</p>
          <h1 className="text-3xl font-semibold gradient-title">Transactions</h1>
        </div>
        <div className="rounded-full bg-white/70 px-4 py-2 text-sm shadow">Balance: ${balance.toFixed(2)}</div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <div className="grid gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount (+income / -expense)</label>
              <input className="input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" list="category-list" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <datalist id="category-list">
                {categories.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Account</label>
              <input className="input" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={onSubmit}>{editingId ? 'Update' : 'Add'}</button>
            {editingId && <button className="btn btn-secondary" onClick={() => { setForm(emptyTx); setEditingId(null); }}>Cancel</button>}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">All Transactions</h2>
          <div className="space-y-2 text-sm">
            {transactions.length ? transactions.map(tx => (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-slate-500">{tx.date} • {tx.category || 'Uncategorized'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>${tx.amount.toFixed(2)}</span>
                  <button className="btn" onClick={() => onEdit(tx)}>Edit</button>
                  <button className="btn btn-secondary" onClick={() => onDelete(tx.id)}>Delete</button>
                </div>
              </div>
            )) : (
              <p className="text-slate-500">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
