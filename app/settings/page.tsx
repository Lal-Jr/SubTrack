'use client';

import { useEffect, useState } from 'react';
import db, { Category, Rule } from '../../db/schema';

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');

  const load = async () => {
    const [cats, ruleList] = await Promise.all([
      db.categories.toArray(),
      db.rules.toArray(),
    ]);
    setCategories(cats);
    setRules(ruleList);
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    await db.categories.add({ id: crypto.randomUUID(), name: categoryName.trim() });
    setCategoryName('');
    load();
  };

  const addRule = async () => {
    if (!ruleKeyword.trim() || !ruleCategory.trim()) return;
    await db.rules.add({ id: crypto.randomUUID(), keyword: ruleKeyword.trim(), category: ruleCategory.trim() });
    setRuleKeyword('');
    setRuleCategory('');
    load();
  };

  const deleteCategory = async (id: string) => {
    await db.categories.delete(id);
    load();
  };

  const deleteRule = async (id: string) => {
    await db.rules.delete(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Preferences</p>
        <h1 className="text-3xl font-semibold gradient-title">Settings</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
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
            <input className="input" value={ruleCategory} onChange={e => setRuleCategory(e.target.value)} placeholder="category" />
            <button className="btn" onClick={addRule}>Add Rule</button>
          </div>
          <ul className="space-y-2 text-sm">
            {rules.map(r => (
              <li key={r.id} className="flex items-center justify-between">
                <span>{r.keyword} → {r.category}</span>
                <button className="btn btn-secondary" onClick={() => deleteRule(r.id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
