'use client';

import CSVUploadComponent from '@/components/CSVUploadComponent';
import Modal from '@/components/Modal';

export default function ImportModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import Statements"
            icon={<div className="w-2 h-2 rounded-full bg-emerald-500"></div>}
            maxWidthClass="max-w-xl"
            contentClassName="p-5 overflow-y-auto custom-scrollbar min-h-[300px]"
        >
            <CSVUploadComponent onSuccess={onClose} />
        </Modal>
    );
}
