'use client';

import { useState } from 'react';
import { buildTransactionsFromRows, importTransactions, parseCSV } from '../../utils/csvImport';
import { categorizeTransactions } from '../../utils/categorization';

export default function ImportPage() {
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
  const [message, setMessage] = useState('');

  const onFile = async (file: File) => {
    const parsed = await parseCSV(file);
    setFields(parsed.fields);
    setRows(parsed.rows);
  };

  const doImport = async () => {
    const txs = buildTransactionsFromRows(rows, mapping);
    const categorized = await categorizeTransactions(txs);
    const count = await importTransactions(categorized);
    setMessage(`Imported ${count} transactions.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Data Intake</p>
        <h1 className="text-3xl font-semibold gradient-title">Import CSV</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <div className="card space-y-3">
          <input type="file" accept=".csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          {fields.length > 0 && (
            <div className="grid gap-2">
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
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </div>

        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Preview</h2>
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
    </div>
  );
}
