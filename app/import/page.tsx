import ImportFlow from '@/components/import/ImportFlow';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ImportPage() {
    return (
        <div className="max-w-2xl">
            <PageHeader title="Read a statement" />
            <ImportFlow />
        </div>
    );
}
