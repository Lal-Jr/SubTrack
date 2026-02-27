import Link from 'next/link';
import ProfileForm from '@/components/ProfileForm';
import CSVUploadComponent from '@/components/CSVUploadComponent';

export default function ProfilePage() {
    return (
        <div className="space-y-6 max-w-xl mx-auto mt-4 sm:mt-8">
            <div className="text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold gradient-title">Your Profile</h1>
                    <p className="text-sm text-slate-400 mt-2">
                        Configure your personal details for better context in subscription analysis.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Link href="/add" className="btn text-sm px-4 py-2 shrink-0">
                        Add Subscription
                    </Link>
                    <Link href="#" className="btn btn-secondary text-sm px-4 py-2 shrink-0">
                        Sync Data
                    </Link>
                </div>
            </div>
            <ProfileForm />

            <div className="pt-6 border-t border-slate-800">
                <CSVUploadComponent />
            </div>
        </div>
    );
}
