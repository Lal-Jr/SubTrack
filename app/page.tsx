'use client';

import { useState } from 'react';
import Link from 'next/link';
import SubscriptionTable from '@/components/SubscriptionTable';
import BurnDownChart from '@/components/BurnDownChart';
import SpendDistributionChart from '@/components/SpendDistributionChart';
import QuickStatsWidget from '@/components/QuickStatsWidget';
import UpcomingRenewalsWidget from '@/components/UpcomingRenewalsWidget';
import Salutation from '@/components/Salutation';
import { useWidgets } from '@/lib/useWidgets';
import WidgetManagerModal from '@/components/WidgetManagerModal';

export default function DashboardPage() {
  const { widgets, toggleWidget, isLoaded } = useWidgets();
  const [managerOpen, setManagerOpen] = useState(false);

  // Map widget ID to its component
  const widgetComponentMap: Record<string, React.ReactNode> = {
    'stats': <QuickStatsWidget />,
    'projection': <BurnDownChart />,
    'breakdown': <SpendDistributionChart />,
    'renewals': <UpcomingRenewalsWidget />
  };

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* Header Section */}
      <div className="flex-none flex items-end justify-between gap-4">
        <div>
          <Salutation />
          <p className="text-sm text-slate-400 mt-1 font-medium">Here's your subscription overview.</p>
        </div>
        <div>
          <button
            onClick={() => setManagerOpen(true)}
            className="btn btn-secondary text-sm px-4 py-2 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Customize Widgets
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

        {/* Left Column: Dynamic Widgets */}
        <div className="lg:col-span-4 xl:col-span-5 flex flex-col gap-6 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
          {isLoaded && widgets.filter(w => w.visible).length === 0 && (
            <div className="flex-none bg-[#121214] border border-zinc-800 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 mb-4"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              <p className="text-zinc-400 font-medium mb-2">Your dashboard is empty</p>
              <button onClick={() => setManagerOpen(true)} className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
                Click here to add widgets
              </button>
            </div>
          )}

          {isLoaded ? (
            widgets.filter(w => w.visible).map(widget => (
              <div key={widget.id} className="flex-none bg-[#121214] border border-zinc-800 rounded-2xl p-7 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
                {widgetComponentMap[widget.id]}
              </div>
            ))
          ) : (
            // Initial loading skeletons
            <>
              <div className="flex-none bg-zinc-900 border border-zinc-800 rounded-2xl p-7 min-h-[140px] animate-pulse"></div>
              <div className="flex-none bg-zinc-900 border border-zinc-800 rounded-2xl p-7 min-h-[250px] animate-pulse"></div>
            </>
          )}
        </div>

        {/* Right Column: Table (Fixed Default) */}
        <div className="lg:col-span-8 xl:col-span-7 flex flex-col min-h-0 bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex-none p-5 border-b border-zinc-800 bg-zinc-900/40">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              Your Subscriptions
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar relative">
            <SubscriptionTable />
          </div>
        </div>

      </div>

      {managerOpen && (
        <WidgetManagerModal
          isOpen={managerOpen}
          onClose={() => setManagerOpen(false)}
          widgets={widgets}
          onToggle={toggleWidget}
        />
      )}
    </div>
  );
}
