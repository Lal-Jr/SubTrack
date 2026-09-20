'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import SubscriptionForm from '@/components/subscriptions/SubscriptionForm';
import { Dialog } from '@/components/ui/Dialog';
import { useProfile } from '@/lib/hooks/useData';

type Mode = 'closed' | 'choose' | 'manual';

interface AddApi {
    /** Opens the "add" chooser (manual or import). */
    open: () => void;
    /** Opens the manual form directly. */
    openManual: () => void;
}

const AddContext = createContext<AddApi>({ open: () => {}, openManual: () => {} });
export const useAddSubscription = () => useContext(AddContext);

/** Global "add" flow so the header, the dock and empty states all open the same sheet. */
export function AddProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<Mode>('closed');
    const { currency } = useProfile();
    const close = useCallback(() => setMode('closed'), []);
    const api = useMemo<AddApi>(() => ({ open: () => setMode('choose'), openManual: () => setMode('manual') }), []);

    return (
        <AddContext.Provider value={api}>
            {children}
            <Dialog open={mode === 'choose'} onClose={close} title="Add" width="max-w-md">
                <div className="divide-y divide-line border-y border-line">
                    <button onClick={() => setMode('manual')} className="w-full text-left py-4 group">
                        <p className="font-display text-3xl group-hover:text-accent transition-colors">Type it in</p>
                        <p className="text-sm text-ink-3 mt-1">Name, amount and the next charge date.</p>
                    </button>
                    <Link href="/import" onClick={close} className="block py-4 group">
                        <p className="font-display text-3xl group-hover:text-accent transition-colors">Read a statement</p>
                        <p className="text-sm text-ink-3 mt-1">Drop in a bank CSV or PDF and we find the recurring ones.</p>
                    </Link>
                </div>
            </Dialog>
            <Dialog open={mode === 'manual'} onClose={close} title="New subscription">
                {mode === 'manual' && <SubscriptionForm defaultCurrency={currency} onDone={close} />}
            </Dialog>
        </AddContext.Provider>
    );
}
