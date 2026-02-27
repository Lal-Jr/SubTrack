import Link from 'next/link';
import SubscriptionTable from '@/components/SubscriptionTable';
import BurnDownChart from '@/components/BurnDownChart';
import SpendDistributionChart from '@/components/SpendDistributionChart';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold gradient-title">Dashboard</h1>
          <p className="text-sm text-slate-400">Welcome to Subtrack. Let's build this piece by piece.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BurnDownChart />
        </div>
        <div className="lg:col-span-1">
          <SpendDistributionChart />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold">Your Subscriptions</h2>
        </div>

        <SubscriptionTable />
      </div>
    </div>
  );
}
