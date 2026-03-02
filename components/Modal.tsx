'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    maxWidthClass?: string;
    contentClassName?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    icon,
    children,
    maxWidthClass = 'max-w-xl',
    contentClassName = 'p-5 overflow-y-auto custom-scrollbar'
}: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className={`relative bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${maxWidthClass}`}>
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/40">
                    <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
                        {icon}
                        {title}
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className={contentClassName}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
