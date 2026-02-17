'use client';

import { useEffect, useMemo, useState } from 'react';
import db, { Category, Profile, Rule, Subscription, Transaction } from '../db/schema';
import { forecastExpenses } from '../utils/forecast';
import { detectSubscriptions } from '../utils/subscriptionDetection';
import { autoCategorize } from '../utils/categorization';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

const COLORS = ['#2563eb', '#f97316', '#16a34a', '#a855f7', '#e11d48', '#0ea5e9'];

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const emptyTx: Transaction = {
  id: '',
  date: '',
  description: '',
  amount: 0,
  category: '',
  account: '',
};

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState<Transaction>(emptyTx);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [showAdd, setShowAdd] = useState(false);


  const load = async () => {
    const [txs, subs, profiles, rulesList, cats] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.subscriptions.toArray(),
      db.profiles.toArray(),
      db.rules.toArray(),
      db.categories.toArray(),
    ]);
    setTransactions(txs);
    setSubscriptions(subs);
    setProfile(profiles[0] || null);
    setRules(rulesList);
    setCategories(cats);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const totals = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthExpense = transactions
      .filter(t => t.amount < 0 && t.date.startsWith(monthKey))
      .reduce((a, b) => a + Math.abs(b.amount), 0);
    const income = profile?.monthlyIncome || 0;
    const spentPct = income > 0 ? Math.min(100, (monthExpense / income) * 100) : 0;
    return { monthExpense, spentPct };
  }, [transactions, profile]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.amount < 0).forEach(t => {
      const key = t.category || 'Uncategorized';
      map.set(key, (map.get(key) || 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const key = t.date.slice(0, 7);
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const item = map.get(key)!;
      if (t.amount > 0) item.income += t.amount;
      else item.expense += Math.abs(t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, values]) => ({ month, ...values }));
  }, [transactions]);

  const forecast = useMemo(
    () => forecastExpenses({ transactions, subscriptions, months: 6 }),
    [transactions, subscriptions]
  );

  const onSubmit = async () => {
    const category = form.category || autoCategorize(form, rules);
    const tx: Transaction = {
      ...form,
      amount: -Math.abs(amountInput || 0),
      category,
      id: editingId || crypto.randomUUID()
    };
    if (editingId) await db.transactions.put(tx);
    else await db.transactions.add(tx);
    setForm(emptyTx);
    setAmountInput(0);
    setEditingId(null);
    load();
  };

  const onEdit = (tx: Transaction) => {
    setForm(tx);
    setAmountInput(Math.abs(tx.amount));
    setEditingId(tx.id);
  };

  const onDelete = async (id: string) => {
    await db.transactions.delete(id);
    load();
  };


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


  const createProfile = async () => {
    if (!profileName.trim() || monthlyIncome <= 0) return;
    const newProfile: Profile = {
      id: 'local',
      name: profileName.trim(),
      monthlyIncome,
      createdAt: new Date().toISOString(),
    };
    await db.profiles.clear();
    await db.profiles.add(newProfile);
    setProfile(newProfile);
  };

  if (!profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="card w-full max-w-md space-y-3">
          <h1 className="text-2xl font-semibold gradient-title">Create your account</h1>
          <p className="text-sm text-slate-500">Local-only profile. No data leaves your device.</p>
          <div>
            <label className="label">Your Name</label>
            <input className="input" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="e.g. Alex" />
          </div>
          <div>
            <label className="label">Monthly Income</label>
            <input className="input" type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(Number(e.target.value))} placeholder="e.g. 4200" />
          </div>
          <button className="btn" onClick={createProfile}>Start Tracking</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold gradient-title">Dashboard</h1>
          <p className="text-sm text-slate-500">Everything in one place, optimized for quick scanning.</p>
        </div>
        {installPrompt && (
          <button
            className="btn"
            onClick={async () => {
              installPrompt.prompt();
              await installPrompt.userChoice;
              setInstallPrompt(null);
            }}
          >
            Install App
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card">
          <p className="label">Month-to-date Expense</p>
          <p className="text-2xl font-semibold text-rose-600">{formatINR(totals.monthExpense)}</p>
        </div>
        <div className="card">
          <p className="label">Income Spent</p>
          <p className="text-2xl font-semibold">{totals.spentPct.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">Based on your monthly income</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Insights</h2>
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={80}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No expenses yet.</p>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Trend</h2>
          {monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#16a34a" />
                <Line type="monotone" dataKey="expense" stroke="#e11d48" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No transactions yet.</p>
          )}
        </div>
      </div>

      <details className="card" open>
        <summary className="cursor-pointer text-lg font-semibold">Expense Forecast</summary>
        {forecast.length ? (
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="expense" stroke="#e11d48" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No forecast available.</p>
        )}
      </details>

      <details className="card" open>
        <summary className="cursor-pointer text-lg font-semibold">Subscriptions</summary>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Recent (20)</span>
            <div className="flex gap-2">
              <button className="btn" onClick={detect}>Detect Subscriptions</button>
              <button className="btn" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Close' : 'Add'}</button>
            </div>
          </div>

          {showAdd && (
            <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="label">Expense Amount</label>
                  <input className="input" type="number" value={amountInput} onChange={e => setAmountInput(Number(e.target.value))} />
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
                <div className="flex gap-2">
                  <button className="btn" onClick={onSubmit}>{editingId ? 'Update' : 'Add'}</button>
                  {editingId && <button className="btn btn-secondary" onClick={() => { setForm(emptyTx); setEditingId(null); }}>Cancel</button>}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm">
            {transactions.length ? transactions.slice(0, 20).map(tx => (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-slate-500">{tx.date} • {tx.category || 'Uncategorized'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatINR(Math.abs(tx.amount))}</span>
                  <button className="btn" onClick={() => onEdit(tx)}>Edit</button>
                  <button className="btn btn-secondary" onClick={() => onDelete(tx.id)}>Delete</button>
                </div>
              </div>
            )) : (
              <p className="text-slate-500">No subscriptions yet.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Subscriptions (Detected)</h3>
          </div>
          {subscriptions.length ? (
            <div className="mt-2 space-y-2 text-sm">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] gap-2 text-xs uppercase tracking-wide text-slate-500">
                <span>Name</span>
                <span>Last / Next</span>
                <span>Amount</span>
                <span>Frequency</span>
                <span>Status</span>
              </div>
              <div className="soft-divider" />
              {subscriptions.map(sub => (
                <div key={sub.id} className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] items-center gap-2">
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
                  <select
                    className="input"
                    value={sub.frequency || 'monthly'}
                    onChange={e => updateSub({ ...sub, frequency: e.target.value as Subscription['frequency'] })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="once">Once</option>
                  </select>
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
      </details>


    </div>
  );
}
