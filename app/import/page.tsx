import ImportFlow from '@/components/import/ImportFlow';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ImportPage() {
    return (
        <div className="max-w-2xl">
            <PageHeader title="Import a statement" description="Find recurring payments in your bank statement" />
            <Card className="p-5 sm:p-6"><ImportFlow /></Card>
        </div>
    );
}
