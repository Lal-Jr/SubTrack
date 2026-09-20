'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    /** Tailwind max-width class. */
    width?: string;
}

/** Modal dialog: closes on Escape and backdrop click, locks page scroll, restores focus. */
export function Dialog({ open, onClose, title, children, width = 'max-w-lg' }: Props) {
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // Focus the panel unless a field inside it (autoFocus) already took focus.
        if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            previous?.focus();
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={`relative w-full ${width} max-h-[92dvh] flex flex-col bg-surface border border-line-strong rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none`}
            >
                <div className="flex items-center justify-between px-5 h-14 shrink-0">
                    <h2 className="font-display text-2xl">{title}</h2>
                    <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full text-ink-3 hover:text-ink hover:bg-raised">✕</button>
                </div>
                <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
