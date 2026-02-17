'use client';

import { useEffect, useState } from 'react';
import db, { Category, Profile, Rule } from '../../db/schema';
import { buildTransactionsFromRows, importTransactions, parseCSV } from '../../utils/csvImport';
import { categorizeTransactions } from '../../utils/categorization';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleAccount, setRuleAccount] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({
    date: '',
    description: '',
    amount: '',
    debit: '',
    credit: '',
    category: '',
    account: '',
  });
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const [profiles, cats, ruleList] = await Promise.all([
        db.profiles.toArray(),
        db.categories.toArray(),
        db.rules.toArray(),
      ]);
      const p = profiles[0] || null;
      setProfile(p);
      if (p) {
        setName(p.name);
        setMonthlyIncome(p.monthlyIncome);
      }
      setCategories(cats);
      setRules(ruleList);
    };
    load();
  }, []);

  const save = async () => {
    if (!name.trim() || monthlyIncome <= 0) return;
    const updated: Profile = {
      id: profile?.id || 'local',
      name: name.trim(),
      monthlyIncome,
      createdAt: profile?.createdAt || new Date().toISOString(),
    };
    await db.profiles.clear();
    await db.profiles.add(updated);
    setProfile(updated);
    setMessage('Saved locally.');
    setTimeout(() => setMessage(''), 1500);
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    await db.categories.add({ id: crypto.randomUUID(), name: categoryName.trim() });
    setCategoryName('');
    const cats = await db.categories.toArray();
    setCategories(cats);
  };

  const deleteCategory = async (id: string) => {
    await db.categories.delete(id);
    const cats = await db.categories.toArray();
    setCategories(cats);
  };

  const addRule = async () => {
    if (!ruleKeyword.trim() && !ruleAccount.trim()) return;
    if (!ruleCategory.trim()) return;
    await db.rules.add({
      id: crypto.randomUUID(),
      keyword: ruleKeyword.trim(),
      accountKeyword: ruleAccount.trim(),
      category: ruleCategory.trim(),
    });
    setRuleKeyword('');
    setRuleAccount('');
    setRuleCategory('');
    const ruleList = await db.rules.toArray();
    setRules(ruleList);
  };

  const deleteRule = async (id: string) => {
    await db.rules.delete(id);
    const ruleList = await db.rules.toArray();
    setRules(ruleList);
  };

  const onFile = async (file: File) => {
    const parsed = await parseCSV(file);
    setFields(parsed.fields);
    setRows(parsed.rows);
  };

  const doImport = async () => {
    const txs = buildTransactionsFromRows(rows, mapping);
    const categorized = await categorizeTransactions(txs);
    const count = await importTransactions(categorized);
    setImportMessage(`Imported ${count} transactions.`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold gradient-title">Profile</h1>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Personal</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Monthly Income (INR)</label>
          <input className="input" type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(Number(e.target.value))} />
        </div>
        <button className="btn" onClick={save}>Save</button>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="flex gap-2">
          <input className="input" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Groceries" />
          <button className="btn" onClick={addCategory}>Add</button>
        </div>
        <ul className="space-y-2 text-sm">
          {categories.map(c => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name}</span>
              <button className="btn btn-secondary" onClick={() => deleteCategory(c.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Auto-Categorization Rules</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input className="input" value={ruleKeyword} onChange={e => setRuleKeyword(e.target.value)} placeholder="keyword (e.g. amazon)" />
          <input className="input" value={ruleAccount} onChange={e => setRuleAccount(e.target.value)} placeholder="account keyword" />
          <input className="input" value={ruleCategory} onChange={e => setRuleCategory(e.target.value)} placeholder="category" />
          <button className="btn" onClick={addRule}>Add Rule</button>
        </div>
        <ul className="space-y-2 text-sm">
          {rules.map(r => (
            <li key={r.id} className="flex items-center justify-between">
              <span>{r.keyword || '—'}{r.accountKeyword ? ` | ${r.accountKeyword}` : ''} → {r.category}</span>
              <button className="btn btn-secondary" onClick={() => deleteRule(r.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">CSV Import</h2>
        <input type="file" accept=".csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {fields.length > 0 && (
          <div className="grid gap-2 md:grid-cols-3">
            {['date','description','amount','debit','credit','category','account'].map(key => (
              <div key={key}>
                <label className="label">{key.toUpperCase()}</label>
                <select className="input" value={(mapping as any)[key]} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}>
                  <option value="">-- none --</option>
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {fields.length > 0 && (
          <button className="btn" onClick={doImport}>Import</button>
        )}
        {importMessage && <p className="text-sm text-emerald-600">{importMessage}</p>}
        {rows.length ? (
          <div className="overflow-auto text-sm">
            <table className="min-w-full">
              <thead>
                <tr>
                  {fields.map(f => <th key={f} className="text-left p-2 border-b">{f}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    {fields.map(f => <td key={f} className="p-2 border-b">{r[f]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500">Upload a CSV to preview.</p>
        )}
      </div>
    </div>
  );
}
