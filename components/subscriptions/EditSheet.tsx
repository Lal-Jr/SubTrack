'use client';

import { useState } from 'react';
import SubscriptionForm from '@/components/subscriptions/SubscriptionForm';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { deleteSubscription, setActive } from '@/lib/subscriptions/store';
import { isActive, type SubscriptionRow } from '@/lib/subscriptions/types';

/** Edit dialog for one subscription, with cancel/resume and a delete confirmation. Shared by every screen that opens a subscription. */
export default function EditSheet({ sub, currency, onClose }: { sub: SubscriptionRow | null; currency: string; onClose: () => void }) {
    const [deleting, setDeleting] = useState<SubscriptionRow | null>(null);

    return (
        <>
            <Dialog open={sub !== null} onClose={onClose} title={sub?.name ?? 'Edit'}>
                {sub && (
                    <SubscriptionForm
                        key={sub.id}
                        existing={sub}
                        defaultCurrency={currency}
                        onDone={onClose}
                        onToggleActive={async () => { await setActive(sub.id, !isActive(sub)); onClose(); }}
                        onDelete={() => { setDeleting(sub); onClose(); }}
                    />
                )}
            </Dialog>
            <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete subscription?" width="max-w-sm">
                <p className="text-sm text-ink-2">
                    <span className="text-ink font-medium">{deleting?.name}</span> will be removed permanently. If you only stopped paying for it, mark it as cancelled instead to keep the history.
                </p>
                <div className="flex justify-end gap-2 mt-5">
                    <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
                    <Button variant="danger" onClick={async () => { if (deleting) await deleteSubscription(deleting.id); setDeleting(null); }}>Delete</Button>
                </div>
            </Dialog>
        </>
    );
}
