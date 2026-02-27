'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '@/lib/powersync';
import { useRouter } from 'next/navigation';

// Configure the PDF.js worker to use the local file instead of CDN
// This avoids CORS and Next.js Turbopack blocking issues.
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface ParsedTransaction {
    date: Date;
    description: string;
    amount: number;
}

interface FoundSubscription {
    id: string; // temporary id
    name: string;
    amount: number;
    currency: string;
    intervalType: string;
    nextChargeDate: string;
    selected: boolean;
}

export default function CSVUploadComponent() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [foundSubscriptions, setFoundSubscriptions] = useState<FoundSubscription[]>([]);
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [profileId, setProfileId] = useState<string | null>(null);
    const [lastCsvUpload, setLastCsvUpload] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch profile id and last_csv_upload
    useEffect(() => {
        let mounted = true;
        const loadProfile = async () => {
            try {
                let attempts = 0;
                let result: any = null;
                while (attempts < 5) {
                    try {
                        result = await db.getOptional('SELECT id, last_csv_upload FROM profiles LIMIT 1');
                        break;
                    } catch (e: any) {
                        if (e.message?.includes('open') || e.message?.includes('initialize')) {
                            attempts++;
                            await new Promise(r => setTimeout(r, 300));
                        } else {
                            throw e;
                        }
                    }
                }
                if (mounted && result) {
                    setProfileId(result.id);
                    setLastCsvUpload(result.last_csv_upload);
                }
            } catch (err) {
                console.error("Error loading profile for CSV chunk", err);
            }
        };
        loadProfile();
        return () => { mounted = false; };
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            try {
                await processPdf(file);
            } catch (error) {
                console.error("PDF Parse Error", error);
                alert("Failed to parse PDF file.");
                setLoading(false);
            }
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results: any) => {
                    analyzeTransactions(results.data as Record<string, string>[]);
                },
                error: (err: any) => {
                    console.error("CSV Parse Error", err);
                    alert("Failed to parse CSV file.");
                    setLoading(false);
                }
            });
        }
    };

    const processPdf = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        const extractedTransactions: ParsedTransaction[] = [];

        // This is a heuristic regex. It looks for lines that start with a date (e.g. 12/05 or 12/05/2026 or 12-05)
        // and end with a number (amount).
        // e.g., "12/05/2026   Netflix Subscription   15.99"
        const lineRegex = /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.*?)\s+([\d,\.]+)$/;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Reconstruct text lines. PDFjs returns chunks with x, y coordinates.
            // We'll group by "y" coordinate to form lines.
            const linesMap: Record<number, string[]> = {};

            textContent.items.forEach((item: any) => {
                if (item.str && item.str.trim() !== '') {
                    // Round y to group items on roughly the same line
                    const y = Math.round(item.transform[5] / 5) * 5;
                    if (!linesMap[y]) linesMap[y] = [];
                    linesMap[y].push(item.str.trim());
                }
            });

            // Sort Y descending (top to bottom)
            const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);

            for (const y of sortedY) {
                const line = linesMap[y].join(' ').replace(/\s{2,}/g, ' '); // Normalize multiple spaces
                const match = line.match(lineRegex);

                if (match) {
                    const [_, dateStr, descStr, amountStr] = match;

                    const cleanAmount = parseFloat(amountStr.replace(/,/g, '').replace(/[^0-9.-]+/g, ""));
                    const amount = Math.abs(cleanAmount);

                    let date = new Date(dateStr);
                    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

                    if (parts.length === 3) {
                        let year = parseInt(parts[2]);
                        if (year < 100) year += 2000;

                        let month, day;
                        if (parseInt(parts[0]) > 12) { // Definitely DD/MM
                            day = parseInt(parts[0]);
                            month = parseInt(parts[1]) - 1;
                        } else if (parseInt(parts[1]) > 12) { // Definitely MM/DD
                            month = parseInt(parts[0]) - 1;
                            day = parseInt(parts[1]);
                        } else {
                            // Ambiguous (e.g. 01/02/2026). Assume DD/MM/YYYY in this locale
                            day = parseInt(parts[0]);
                            month = parseInt(parts[1]) - 1;
                        }

                        date = new Date(Date.UTC(year, month, day));
                    } else if (dateStr.length <= 5) {
                        // MM/DD or DD/MM missing year
                        const currentYear = new Date().getFullYear();
                        const parseParts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
                        if (parseParts.length === 2) {
                            const p1 = parseInt(parseParts[0]);
                            const p2 = parseInt(parseParts[1]);
                            if (p1 > 12) date = new Date(Date.UTC(currentYear, p2 - 1, p1)); // DD/MM
                            else date = new Date(Date.UTC(currentYear, p2 - 1, p1)); // Assume DD/MM
                        }
                    }

                    if (!isNaN(date.getTime()) && !isNaN(amount) && amount > 0) {
                        extractedTransactions.push({
                            date,
                            description: descStr,
                            amount
                        });
                    }
                }
            }
        }

        await analyzeParsedTransactions(extractedTransactions);
    };

    const guessColumns = (row: Record<string, string>) => {
        const keys = Object.keys(row);
        let dateCol, descCol, amountCol;

        for (const key of keys) {
            const lowerDate = key.toLowerCase();
            if (lowerDate.includes('date')) dateCol = key;
            if (lowerDate.includes('desc') || lowerDate.includes('detail') || lowerDate.includes('narrative') || lowerDate.includes('payee')) descCol = key;
            if (lowerDate.includes('amount') || lowerDate.includes('withdrawal') || lowerDate.includes('debit')) amountCol = key;
        }

        return { dateCol, descCol, amountCol };
    };

    const analyzeTransactions = async (data: Record<string, string>[]) => {
        if (data.length === 0) {
            setLoading(false);
            return;
        }

        const cols = guessColumns(data[0]);

        if (!cols.dateCol || !cols.descCol || !cols.amountCol) {
            alert("Could not automatically determine Date, Description, and Amount columns. Please ensure standard headers are used.");
            setLoading(false);
            return;
        }

        const transactions: ParsedTransaction[] = [];

        // Parse raw transactions
        data.forEach(row => {
            const dateStr = row[cols.dateCol as string];
            const descStr = row[cols.descCol as string];
            const amountStr = row[cols.amountCol as string];

            if (dateStr && descStr && amountStr) {
                // Remove commas from amount (e.g. 1,000.00 -> 1000.00)
                const cleanAmount = parseFloat(amountStr.replace(/,/g, '').replace(/[^0-9.-]+/g, ""));
                // Some banks use positive for withdrawals, some negative. Let's assume we take absolute value but mostly look for debits.
                // If there's a separate Credit/Debit column, it's trickier. We will assume the amount has sign or we just take absolute.
                const amount = Math.abs(cleanAmount);

                let date = new Date(dateStr);
                const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

                if (parts.length === 3) {
                    let year = parseInt(parts[2]);
                    if (year < 100) year += 2000;

                    let month, day;
                    if (parseInt(parts[0]) > 12) { // Definitely DD/MM
                        day = parseInt(parts[0]);
                        month = parseInt(parts[1]) - 1;
                    } else if (parseInt(parts[1]) > 12) { // Definitely MM/DD
                        month = parseInt(parts[0]) - 1;
                        day = parseInt(parts[1]);
                    } else {
                        // Ambiguous. Assume DD/MM/YYYY
                        day = parseInt(parts[0]);
                        month = parseInt(parts[1]) - 1;
                    }

                    date = new Date(Date.UTC(year, month, day));
                }

                if (!isNaN(date.getTime()) && !isNaN(amount) && amount > 0) {
                    transactions.push({
                        date,
                        description: descStr,
                        amount
                    });
                }
            }
        });

        await analyzeParsedTransactions(transactions);
    };

    const analyzeParsedTransactions = async (transactions: ParsedTransaction[]) => {
        if (transactions.length === 0) {
            setLoading(false);
            alert("No valid transactions found in the file.");
            return;
        }

        // Group by similarity
        const groups: Record<string, ParsedTransaction[]> = {};

        transactions.forEach(t => {
            // Simplify description: remove numbers, standard words, lowercase
            let norm = t.description.toLowerCase()
                .replace(/[0-9]+/g, '')
                .replace(/pvt|ltd|upi|card|txn|ref/g, '')
                .replace(/[^a-z]+/g, ' ')
                .trim();

            // Further simplify to first two significant words if possible to group better
            const words = norm.split(' ').filter(w => w.length > 2);
            let key = words.slice(0, 2).join(' ');
            if (!key) key = norm; // fallback

            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        const distinctSubscriptions: FoundSubscription[] = [];

        Object.keys(groups).forEach(key => {
            const txns = groups[key];
            if (txns.length < 2) return; // Need at least 2 to find a pattern

            // Sort by date ascending
            txns.sort((a, b) => a.date.getTime() - b.date.getTime());

            let isRecurring = true;
            let avgDays = 0;

            for (let i = 1; i < txns.length; i++) {
                const diffTime = Math.abs(txns[i].date.getTime() - txns[i - 1].date.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Check if roughly monthly (20 to 40 days to allow for February and long months)
                if (diffDays < 20 || diffDays > 40) {
                    isRecurring = false;
                    break;
                }
                avgDays += diffDays;
            }

            if (isRecurring) {
                // It looks like a monthly subscription
                const latestTxn = txns[txns.length - 1];

                // Predict next charge date (approx 1 month from latest)
                const nextDate = new Date(latestTxn.date);
                nextDate.setMonth(nextDate.getMonth() + 1);

                distinctSubscriptions.push({
                    id: crypto.randomUUID(),
                    name: latestTxn.description.substring(0, 30).trim(), // Original recognizable name
                    amount: latestTxn.amount,
                    currency: 'INR', // Defaulting for now
                    intervalType: 'monthly',
                    nextChargeDate: nextDate.toISOString().split('T')[0],
                    selected: true,
                });
            }
        });

        // Fetch existing subscriptions to deduplicate
        let existingSubscriptions: { name: string, amount: number }[] = [];
        try {
            const res = await db.getAll('SELECT name, amount FROM subscriptions');
            existingSubscriptions = res as { name: string, amount: number }[];
        } catch (err) {
            console.error("Could not fetch existing subscriptions for deduplication", err);
        }

        // Filter out subscriptions that already exist in DB (matching near name or exact amount)
        const newSubscriptions = distinctSubscriptions.filter(newSub => {
            const isDuplicate = existingSubscriptions.some(ex => {
                const nameMatch = ex.name.toLowerCase().includes(newSub.name.toLowerCase()) ||
                    newSub.name.toLowerCase().includes(ex.name.toLowerCase());
                const amountMatch = Math.abs(ex.amount - newSub.amount) < 1; // within 1 unit
                return nameMatch && amountMatch;
            });
            return !isDuplicate;
        });

        setFoundSubscriptions(newSubscriptions);
        setStep('review');
        setLoading(false);
    };

    const toggleSelection = (id: string) => {
        setFoundSubscriptions(prev =>
            prev.map(sub => sub.id === id ? { ...sub, selected: !sub.selected } : sub)
        );
    };

    const handleImport = async () => {
        setLoading(true);
        const selected = foundSubscriptions.filter(s => s.selected);
        const now = Date.now();

        try {
            for (const sub of selected) {
                const id = crypto.randomUUID();
                await db.execute(
                    `INSERT INTO subscriptions 
              (id, name, amount, currency, interval_count, interval_unit, next_charge_date, source, confidence, active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        sub.name,
                        sub.amount,
                        sub.currency,
                        1,
                        'month',
                        sub.nextChargeDate,
                        'csv_import',
                        0.8,
                        1,
                        now,
                        now
                    ]
                );
            }

            // Update profile last_csv_upload
            if (profileId) {
                await db.execute(
                    'UPDATE profiles SET last_csv_upload = ?, updated_at = ? WHERE id = ?',
                    [now, now, profileId]
                );
            } else {
                // Try to fetch profile and update or create if needed. 
                // Assuming user already has a profile if they are on this page, but as fallback:
                const profile = await db.getOptional('SELECT id FROM profiles LIMIT 1');
                if (profile) {
                    await db.execute(
                        'UPDATE profiles SET last_csv_upload = ?, updated_at = ? WHERE id = ?',
                        [now, now, (profile as any).id]
                    );
                }
            }

            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Failed to import subscriptions', error);
            alert('Failed to import subscriptions.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">

            {step === 'upload' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                        Upload your bank statement (CSV or PDF format) to automatically detect recurring subscriptions.
                        We look for standard recurring payments that happen roughly every month.
                    </p>

                    {lastCsvUpload && (
                        <p className="text-xs text-emerald-400/80 bg-emerald-400/10 inline-block px-2 py-1 rounded">
                            Last imported: {new Date(lastCsvUpload).toLocaleDateString()}
                        </p>
                    )}

                    <div className="border border-dashed border-white/10 rounded-xl p-8 text-center hover:bg-white/[0.04] transition-colors bg-white/[0.01]">
                        <input
                            type="file"
                            accept=".csv,.pdf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                        >
                            {loading ? 'Analyzing...' : 'Select CSV or PDF File'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
                        <div>
                            <p className="font-medium text-emerald-400">Analysis Complete</p>
                            <p className="text-xs text-slate-400">We found {foundSubscriptions.length} potential subscriptions.</p>
                        </div>
                        <button
                            type="button"
                            className="text-sm text-slate-400 hover:text-white"
                            onClick={() => setStep('upload')}
                        >
                            Cancel
                        </button>
                    </div>

                    {foundSubscriptions.length === 0 ? (
                        <div className="text-center p-8 text-slate-400">
                            No recurring payments found that look like monthly subscriptions.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {foundSubscriptions.map(sub => (
                                <div
                                    key={sub.id}
                                    className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${sub.selected ? 'bg-white/10 border border-white/20' : 'bg-white/5 border border-transparent opacity-60'}`}
                                    onClick={() => toggleSelection(sub.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={sub.selected}
                                        readOnly
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                    />
                                    <div className="flex-1">
                                        <p className="font-medium truncate" title={sub.name}>{sub.name}</p>
                                        <p className="text-xs text-slate-400">Next bill: {sub.nextChargeDate}</p>
                                    </div>
                                    <div className="font-semibold text-right">
                                        <span className="text-xs text-slate-400 mr-1">{sub.currency}</span>
                                        {sub.amount.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {foundSubscriptions.length > 0 && (
                        <div className="pt-4 flex justify-end">
                            <button
                                type="button"
                                className="btn"
                                onClick={handleImport}
                                disabled={loading || !foundSubscriptions.some(s => s.selected)}
                            >
                                {loading ? 'Importing...' : `Import ${foundSubscriptions.filter(s => s.selected).length} Subscriptions`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
