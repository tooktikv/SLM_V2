import type { ReactNode } from 'react';
import { companyProfiles } from '../data/companyProfile';
import { dbdRecords, hasDbd } from '../data/dbd';
import DbdRegistry from './DbdRegistry';
import { Badge, DetailGrid } from './ui';

type CompanySupplier = { id: string; name: string; country: string; taxId?: string };

// General company information for every supplier, plus the DBD registry section (N/A for companies outside Thailand).
export default function CompanyInformation({ supplier }: { supplier: CompanySupplier }) {
  const company = companyProfiles[supplier.id];
  const thai = hasDbd(supplier);
  const mono = (value?: string): ReactNode => (value ? <span className="font-mono">{value}</span> : '—');

  return (
    <div>
      <DetailGrid items={[
        { label: 'Legal name', value: supplier.name },
        { label: 'Trading name', value: supplier.name.replace(/,?\s+(Co\.,\s*Ltd\.|Ltd|Inc|Co\.|GmbH)$/, '') },
        { label: 'Supplier ID', value: supplier.id },
        { label: 'Registration number', value: mono(company?.registrationNumber) },
        { label: 'Registry', value: company?.registry ?? '—' },
        { label: 'Tax ID', value: mono(supplier.taxId) },
        { label: 'Country', value: supplier.country },
        { label: 'Founded', value: company?.founded ?? '—' },
        { label: 'Employees', value: company ? company.employees.toLocaleString('en-US') : '—' },
        { label: 'Annual revenue', value: company?.annualRevenue ?? '—' },
        { label: 'Website', value: company?.website ?? '—' },
        { label: 'Registered address', value: company?.registeredAddress ?? '—', wide: true },
      ]} />
      {company && <p className="mt-3 text-caption text-ink-muted">Source: {company.source}{thai ? '' : '. Not verified against a company registry.'}</p>}
      <div className="mt-5 border-t border-line-subtle pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-body font-semibold text-ink">DBD registry data</div>
          <Badge small>Department of Business Development</Badge>
        </div>
        <DbdRegistry record={thai ? dbdRecords[supplier.id] : undefined} />
      </div>
    </div>
  );
}
