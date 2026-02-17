'use client';

import { useEffect, useMemo, useState } from 'react';
import db, { Subscription, Transaction } from '../db/schema';
import { forecastBalance } from '../utils/forecast';
import { detectSubscriptions } from '../utils/subscriptionDetection';
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

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const txs = await db.transactions.toArray();
      setTransactions(txs);
      const subs = await db.subscriptions.toArray();
      setSubscriptions(subs);
      if (!subs.length && txs.length) {
        const detected = detectSubscriptions(txs);
        if (detected.length) {
          await db.subscriptions.bulkAdd(detected);
          setSubscriptions(detected);
        }
      }
    };
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
    const income = transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);
    const balance = income - expense;
    return { income, expense, balance };
  }, [transactions]);

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

  const forecast = useMemo(() => forecastBalance({ transactions, subscriptions, months: 6 }), [transactions, subscriptions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Overview</p>
          <h1 className="text-3xl font-semibold gradient-title">Dashboard</h1>
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

      <div className="stat-chip text-xs text-slate-600">
        Offline-first • Local data • PWA
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="label">Current Balance</p>
          <p className="text-2xl font-semibold">${totals.balance.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="label">Total Income</p>
          <p className="text-2xl font-semibold text-emerald-600">${totals.income.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="label">Total Expense</p>
          <p className="text-2xl font-semibold text-rose-600">${totals.expense.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Spend by Category</h2>
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90}>
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
          <h2 className="mb-2 text-lg font-semibold">Monthly Trend</h2>
          {monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={240}>
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Forecast (6 months)</h2>
          {forecast.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="balance" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No forecast available.</p>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Active Subscriptions</h2>
          {subscriptions.filter(s => s.active).length ? (
            <ul className="space-y-2 text-sm">
              {subscriptions.filter(s => s.active).map(sub => (
                <li key={sub.id} className="flex items-center justify-between">
                  <span>{sub.name}</span>
                  <span>${sub.avgAmount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No subscriptions detected yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
