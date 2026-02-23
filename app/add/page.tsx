import Link from 'next/link';
import AddSubscriptionForm from '@/components/AddSubscriptionForm';

export default function AddSubscriptionPage() {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/" className="nav-pill flex items-center gap-1 text-sm font-medium">
                    ← Back
                </Link>
                <h1 className="text-2xl font-semibold gradient-title">Add Subscription</h1>
            </div>

            <div className="card">
                <div className="mb-4">
                    <p className="text-slate-600 text-sm">
                        Manually enter a subscription below. This will be stored securely in your local database.
                    </p>
                </div>
                <AddSubscriptionForm />
            </div>
        </div>
    );
}
