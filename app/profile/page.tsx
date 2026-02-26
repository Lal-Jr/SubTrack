import ProfileForm from '@/components/ProfileForm';

export default function ProfilePage() {
    return (
        <div className="space-y-6 max-w-xl mx-auto mt-4 sm:mt-8">
            <div className="text-center sm:text-left">
                <h1 className="text-3xl font-semibold gradient-title">Your Profile</h1>
                <p className="text-sm text-slate-500 mt-2">
                    Configure your personal details for better context in subscription analysis.
                </p>
            </div>
            <ProfileForm />
        </div>
    );
}
