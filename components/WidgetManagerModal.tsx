'use client';

import { WidgetPref, WidgetType } from '@/lib/useWidgets';

export default function WidgetManagerModal({
    isOpen,
    onClose,
    widgets,
    onToggle
}: {
    isOpen: boolean;
    onClose: () => void;
    widgets: WidgetPref[];
    onToggle: (id: WidgetType) => void;
}) {
    if (!isOpen) return null;

    const widgetNames: Record<WidgetType, string> = {
        'stats': 'Quick Stats',
        'breakdown': 'Spend Breakdown',
        'category-pie': 'Category Breakdown',
        'forecast': '3-Month Forecast',
        'calendar': 'Renewal Calendar'
    };

    const widgetDescriptions: Record<WidgetType, string> = {
        'stats': 'High-level overview of totals and averages.',
        'breakdown': 'Pie chart breaking down your monthly costs.',
        'category-pie': 'Pie chart grouping subscriptions by category.',
        'forecast': 'Area chart projecting spending for the next 3 months.',
        'calendar': 'Monthly calendar grid showing upcoming charges.'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <h2 className="text-xl font-semibold text-white">Customize Overview</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-400 mb-2">Show or hide widgets on your main dashboard.</p>

                    {widgets.map(widget => (
                        <div
                            key={widget.id}
                            className={`flex items-start gap-4 p-4 rounded-xl border ${widget.visible ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-60'} transition-all cursor-pointer`}
                            onClick={() => onToggle(widget.id)}
                        >
                            <div className="flex-none mt-0.5">
                                <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${widget.visible ? 'bg-indigo-500 text-white' : 'bg-slate-800 border border-slate-600'}`}>
                                    {widget.visible && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-slate-200">{widgetNames[widget.id]}</h3>
                                <p className="text-xs text-slate-500 mt-1">{widgetDescriptions[widget.id]}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-5 border-t border-white/5 bg-slate-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="btn justify-center min-w-[100px]"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
