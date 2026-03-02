'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/powersync';
import { useRouter } from 'next/navigation';
import { detectRecurringSubscriptions, Transaction as DetectionTransaction } from '@/lib/subscriptionDetection';
import { parseStatement } from '@/lib/statementParser';

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
    category?: string;
}

interface CSVUploadComponentProps {
    onSuccess?: () => void;
}

export default function CSVUploadComponent({ onSuccess }: CSVUploadComponentProps = {}) {
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

        try {
            // 1. Parse statement into standardized Transactions
            const rawTransactions = await parseStatement(file);

            if (rawTransactions.length === 0) {
                setLoading(false);
                alert("No valid transactions found in the file.");
                return;
            }

            // 2. Map parser Transaction directly to the DetectionTransaction expected by the module
            const detectionInput: DetectionTransaction[] = rawTransactions.map(t => ({
                date: t.date, // already an ISO string
                description: t.description,
                amount: t.type === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount)
            }));

            // 3. Run the recurring subscription detection module
            const detectedSubs = detectRecurringSubscriptions(detectionInput);

            // 4. Map the module format to our UI state format
            const distinctSubscriptions: FoundSubscription[] = detectedSubs.map(ds => ({
                id: crypto.randomUUID(),
                name: ds.merchant,
                amount: ds.averageAmount,
                currency: 'INR', // Defaulting for now
                intervalType: ds.frequency.toLowerCase(),
                nextChargeDate: ds.nextExpectedPayment.split('T')[0],
                selected: true,
            }));

            // 5. Fetch existing subscriptions to deduplicate
            let existingSubscriptions: { name: string, amount: number }[] = [];
            try {
                const res = await db.getAll('SELECT name, amount FROM subscriptions');
                existingSubscriptions = res as { name: string, amount: number }[];
            } catch (err) {
                console.error("Could not fetch existing subscriptions for deduplication", err);
            }

            // 6. Filter out subscriptions that already exist in DB
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
        } catch (error: any) {
            console.error("Statement Parsing Error", error);
            alert(error.message || "Failed to parse the statement.");
        } finally {
            setLoading(false);
        }
    };


    const toggleSelection = (id: string) => {
        setFoundSubscriptions(prev =>
            prev.map(sub => sub.id === id ? { ...sub, selected: !sub.selected } : sub)
        );
    };

    const handleCategoryChange = (id: string, category: string) => {
        setFoundSubscriptions(prev =>
            prev.map(sub => sub.id === id ? { ...sub, category } : sub)
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
              (id, name, amount, currency, interval_count, interval_unit, next_charge_date, source, confidence, active, created_at, updated_at, category, is_variable) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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
                        now,
                        sub.category || null
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
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-medium truncate" title={sub.name}>{sub.name}</p>
                                        <p className="text-xs text-slate-400">Next bill: {sub.nextChargeDate}</p>
                                        <select
                                            value={sub.category || ''}
                                            onChange={(e) => handleCategoryChange(sub.id, e.target.value)}
                                            className="mt-2 text-xs bg-slate-800 border-slate-700 text-slate-300 rounded p-1 max-w-[140px]"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="">No Category</option>
                                            <option value="Entertainment">Entertainment</option>
                                            <option value="Software">Software</option>
                                            <option value="Utilities">Utilities</option>
                                            <option value="Finance">Finance</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="font-semibold text-right flex-none">
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
