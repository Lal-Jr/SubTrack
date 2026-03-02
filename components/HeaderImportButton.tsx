'use client';

import { useState } from 'react';
import ImportModal from '@/components/ImportModal';

export default function HeaderImportButton() {
    const [importModalOpen, setImportModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setImportModalOpen(true)}
                className="nav-pill flex items-center gap-2"
            >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <span>Import Statements</span>
            </button>

            <ImportModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} />
        </>
    );
}
