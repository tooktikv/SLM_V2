import type { Supplier } from '../../data/suppliers';
import { complianceCompanies } from '../../data/compliance';
import { ItemsTable } from '../../components/ComplianceTracker';
import { useRenewals } from '../../data/renewals';
import { Button, Card, CardHeader, EmptyState, KpiCard, KpiGrid } from '../../components/ui';

// Certificates, insurance, permits and regulatory declarations; contracts, audits and screening stay under Compliance.
export default function DocumentsTab({ supplier, onOpenRegister }: { supplier: Supplier; onOpenRegister: () => void }) {
  useRenewals();
  const documents = (complianceCompanies.find(company => company.id === supplier.id)?.items ?? []).filter(item => item.group === 'Documents');
  const count = (...statuses: string[]) => documents.filter(item => statuses.includes(item.status)).length;

  return (
    <div className="space-y-5">
      <KpiGrid cols={4}>
        <KpiCard label="Total documents" value={documents.length} note="Held for this supplier" tone="brand" size="md" />
        <KpiCard label="Valid" value={count('Verified')} note="Verified by the source" tone="success" size="md" />
        <KpiCard label="Expiring soon" value={count('Expiring')} note="Renewal needed" tone="warning" size="md" />
        <KpiCard label="Expired or missing" value={count('Expired', 'Missing', 'No data received')} note="Follow up with the supplier" tone={count('Expired', 'Missing', 'No data received') ? 'danger' : 'success'} size="md" />
      </KpiGrid>
      <Card className="overflow-hidden">
        <CardHeader title="Document register" description="Certificates, insurance, permits and regulatory declarations for this supplier" actions={<Button variant="link" onClick={onOpenRegister}>View in Document register</Button>} />
        {documents.length ? <ItemsTable items={documents} showGroup={false} supplier={supplier} /> : <EmptyState title="No documents tracked" description="The connected sources have not reported any document for this supplier." />}
      </Card>
    </div>
  );
}
