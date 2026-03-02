import { useState, useEffect } from 'react';

export type WidgetType = 'stats' | 'breakdown' | 'category-pie' | 'forecast' | 'calendar';

export type WidgetPref = {
    id: WidgetType;
    visible: boolean;
};

const DEFAULT_WIDGETS: WidgetPref[] = [
    { id: 'stats', visible: true },
    { id: 'breakdown', visible: true },
    { id: 'category-pie', visible: true },
    { id: 'forecast', visible: true },
    { id: 'calendar', visible: true },
];

export function useWidgets() {
    const [widgets, setWidgets] = useState<WidgetPref[]>(DEFAULT_WIDGETS);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('subtrack_widget_prefs_v3');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as WidgetPref[];
                // Merge with defaults to ensure all expected widgets exist
                // even if they were added in an update after the user saved prefs
                const merged = DEFAULT_WIDGETS.map(def => {
                    const found = parsed.find(p => p.id === def.id);
                    return found ? { ...def, visible: found.visible } : def;
                });

                // Keep the order from parsed if possible
                const ordered = [];
                for (const p of parsed) {
                    const foundInMerged = merged.find(m => m.id === p.id);
                    if (foundInMerged) {
                        ordered.push(foundInMerged);
                    }
                }
                for (const m of merged) {
                    if (!ordered.find(o => o.id === m.id)) {
                        ordered.push(m);
                    }
                }

                setWidgets(ordered);
            } catch (e) {
                console.error('Failed to parse widget prefs', e);
                setWidgets(DEFAULT_WIDGETS);
            }
        }
        setIsLoaded(true);
    }, []);

    const toggleWidget = (id: WidgetType) => {
        setWidgets(prev => {
            const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
            localStorage.setItem('subtrack_widget_prefs_v3', JSON.stringify(next));
            return next;
        });
    };

    const reorderWidgets = (newOrder: WidgetPref[]) => {
        setWidgets(newOrder);
        localStorage.setItem('subtrack_widget_prefs_v3', JSON.stringify(newOrder));
    };

    return { widgets, toggleWidget, reorderWidgets, isLoaded };
}
