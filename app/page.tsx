'use client';

import { useState } from 'react';
import Link from 'next/link';
import SubscriptionTable from '@/components/SubscriptionTable';
import SpendDistributionChart from '@/components/SpendDistributionChart';
import QuickStatsWidget from '@/components/QuickStatsWidget';
import Salutation from '@/components/Salutation';
import { useWidgets } from '@/lib/useWidgets';
import WidgetManagerModal from '@/components/WidgetManagerModal';
import CategoryPieChartWidget from '@/components/CategoryPieChartWidget';
import ForecastChartWidget from '@/components/ForecastChartWidget';
import RenewalCalendarWidget from '@/components/RenewalCalendarWidget';
import TimelineView from '@/components/TimelineView';
import { db } from '@/lib/powersync';

export default function DashboardPage() {
  const { widgets, toggleWidget, isLoaded } = useWidgets();
  const [managerOpen, setManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  // Map widget ID to its component
  const widgetComponentMap: Record<string, React.ReactNode> = {
    'stats': <QuickStatsWidget />,
    'breakdown': <SpendDistributionChart />,
    'category-pie': <CategoryPieChartWidget />,
    'forecast': <ForecastChartWidget />,
    'calendar': <RenewalCalendarWidget />
  };

  const handleSyncData = async () => {
    // Visual feedback for sync - PowerSync handles actual sync automatically
    alert("Data sync queued. PowerSync synchronizes automatically in the background.");
  };

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* Header Section */}
      <div className="flex-none flex items-end justify-between gap-4">
        <div>
          <Salutation />
          <p className="text-sm text-slate-400 mt-1 font-medium">Here's your subscription overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(prev => prev === 'table' ? 'timeline' : 'table')}
            className={`btn text-sm px-4 py-2 flex items-center gap-2 border ${viewMode === 'timeline' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'}`}
          >
            {viewMode === 'timeline' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                Table Mode
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Timeline Mode
              </>
            )}
          </button>
          <button
            onClick={() => setManagerOpen(true)}
            className="btn btn-secondary text-sm px-4 py-2 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Customize Widgets
          </button>
          <button
            onClick={handleSyncData}
            className="btn bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-sm px-4 py-2 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Sync Data
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
          {viewMode === 'table' ? <SubscriptionTable /> : <TimelineView />}
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
