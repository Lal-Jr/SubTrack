'use client';

import AddSubscriptionForm from '@/components/AddSubscriptionForm';
import Modal from '@/components/Modal';

export default function AddSubscriptionModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add Subscription"
            icon={<div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
            maxWidthClass="max-w-2xl"
            contentClassName="p-6 overflow-y-auto custom-scrollbar"
        >
            <AddSubscriptionForm onSuccess={onClose} />
        </Modal>
    );
}
