import Link from 'next/link';
import SubscriptionTable from '@/components/SubscriptionTable';
import BurnDownChart from '@/components/BurnDownChart';
import SpendDistributionChart from '@/components/SpendDistributionChart';
import Salutation from '@/components/Salutation';

export default function DashboardPage() {
  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* Header Section */}
      <div className="flex-none flex items-end justify-between gap-4">
        <div>
          <Salutation />
          <p className="text-sm text-slate-400 mt-1 font-medium">Here's your subscription overview.</p>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

        {/* Left Column: Charts */}
        <div className="lg:col-span-4 xl:col-span-5 flex flex-col gap-6 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
          {/* Spend Projection */}
          <div className="flex-none bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <BurnDownChart />
          </div>

          {/* Distribution */}
          <div className="flex-none bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <SpendDistributionChart />
          </div>
        </div>

        {/* Right Column: Table */}
        <div className="lg:col-span-8 xl:col-span-7 flex flex-col min-h-0 bg-white/[0.02] border border-white/5 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
          <div className="flex-none p-5 border-b border-white/5 bg-white/[0.01]">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              Your Subscriptions
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar relative">
            <SubscriptionTable />
          </div>
        </div>

      </div>
    </div>
  );
}
