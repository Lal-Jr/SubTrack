import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold gradient-title">Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome to Subtrack. Let's build this piece by piece.</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-xl font-semibold">Your Finances</h2>
        <p className="text-slate-600">
          This is your basic skeleton. Currently, there is no database connected and no complex logic running.
        </p>
        <div className="flex gap-4">
          <Link href="/add" className="btn">
            Add Subscription
          </Link>
          <Link href="#" className="btn btn-secondary">
            Sync Data (Coming Soon)
          </Link>
        </div>
      </div>
    </div>
  );
}
