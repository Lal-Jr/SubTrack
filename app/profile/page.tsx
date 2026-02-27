import Link from 'next/link';
import ProfileForm from '@/components/ProfileForm';
import CSVUploadComponent from '@/components/CSVUploadComponent';

export default function ProfilePage() {
    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto overflow-hidden">
            {/* Header Section */}
            <div className="flex-none flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Your Profile</h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Configure your settings and import subscriptions.</p>
                </div>
                <div className="flex flex-wrap gap-4">
                    <Link href="/add" className="btn text-sm px-4 py-2 shrink-0">
                        Add Subscription
                    </Link>
                    <Link href="#" className="btn btn-secondary text-sm px-4 py-2 shrink-0">
                        Sync Data
                    </Link>
                    <Link href="/" className="btn btn-secondary text-sm px-4 py-2 shrink-0">
                        Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">

                {/* Left Column: Personal Details */}
                <div className="flex flex-col min-h-0 bg-white/[0.02] border border-white/5 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
                    <div className="flex-none p-5 border-b border-white/5 bg-white/[0.01]">
                        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            Personal Details
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        <ProfileForm />
                    </div>
                </div>

                {/* Right Column: Data Import */}
                <div className="flex flex-col min-h-0 bg-white/[0.02] border border-white/5 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
                    <div className="flex-none p-5 border-b border-white/5 bg-white/[0.01]">
                        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            Import Data
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        <CSVUploadComponent />
                    </div>
                </div>

            </div>
        </div>
    );
}
