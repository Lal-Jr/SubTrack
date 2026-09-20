import ImportFlow from '@/components/import/ImportFlow';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ImportPage() {
    return (
        <div>
            <PageHeader title="Read a statement" description="Find recurring payments in your bank statement" />
            <ImportFlow />
        </div>
    );
}
