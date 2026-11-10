import { useState } from 'react';
import Header from '../components/Header';
import OrgChart from '../components/OrgChart';
import ExportButton from '../components/ExportButton';
import { ArrowRightIcon } from '../components/icons';
import { contactTone, coverageGaps, supplierProfiles } from '../data/contacts';
import { flattenOrg, orgStructures } from '../data/organization';
import { suppliers } from '../data/suppliers';
import { useNavigation } from '../NavigationContext';
import { Avatar, BackLink, Badge, Button, Card, CardBody, CardHeader, CellStack, EmptyState, Eyebrow, HeadRow, KpiCard, KpiGrid, Page, PageContent, ProgressBar, SearchInput, Select, Table, TableContainer, Td, Toolbar, Tr, cx, toneText, type Tone } from '../components/ui';

type RelationshipCompany = {
  name: string;
  id: string;
  category: string;
  tier: string;
  health: number;
  owner: string;
  primaryContact: string;
  contactRole: string;
  lastEngagement: string;
  nextReview: string;
  openActions: number;
  overdue: number;
  renewal: string;
  spend: string;
};

const companies: RelationshipCompany[] = [
  { name: 'Titan Industries Ltd', id: 'SUP-0012', category: 'Raw Materials', tier: 'Strategic', health: 58, owner: 'S. Chen', primaryContact: 'Klaus Richter', contactRole: 'Account Director', lastEngagement: 'Sep 10, 2024', nextReview: 'Oct 8, 2024', openActions: 3, overdue: 1, renewal: 'Mar 31, 2025', spend: '€18.4M' },
  { name: 'Apex Components Inc', id: 'SUP-0034', category: 'Electronics', tier: 'Preferred', health: 82, owner: 'M. Patel', primaryContact: 'Lin Wei', contactRole: 'Commercial Manager', lastEngagement: 'Sep 6, 2024', nextReview: 'Nov 12, 2024', openActions: 1, overdue: 0, renewal: 'Jun 30, 2025', spend: '$9.8M' },
  { name: 'GlobalTech Manufacturing', id: 'SUP-0051', category: 'Packaging', tier: 'Strategic', health: 69, owner: 'L. Torres', primaryContact: 'Maria Santos', contactRole: 'Key Account Manager', lastEngagement: 'Aug 28, 2024', nextReview: 'Sep 25, 2024', openActions: 4, overdue: 2, renewal: 'Dec 31, 2024', spend: '$12.1M' },
  { name: 'PrimeParts Co.', id: 'SUP-0067', category: 'Mechanical', tier: 'Preferred', health: 91, owner: 'J. Kim', primaryContact: 'Daniel Brooks', contactRole: 'Sales Director', lastEngagement: 'Sep 9, 2024', nextReview: 'Dec 5, 2024', openActions: 0, overdue: 0, renewal: 'Sep 30, 2025', spend: '$7.6M' },
  { name: 'Chemcore Solutions', id: 'SUP-0118', category: 'Chemicals', tier: 'Development', health: 46, owner: 'R. Okafor', primaryContact: 'Adaeze Obi', contactRole: 'Managing Director', lastEngagement: 'Aug 15, 2024', nextReview: 'Overdue', openActions: 5, overdue: 3, renewal: 'Jan 31, 2025', spend: '$4.2M' },
  { name: 'Vertex Systems', id: 'SUP-0089', category: 'IT Services', tier: 'Development', health: 72, owner: 'A. Singh', primaryContact: 'Arisa Chantarawong', contactRole: 'Managing Director', lastEngagement: 'Sep 6, 2024', nextReview: 'Nov 20, 2024', openActions: 2, overdue: 0, renewal: 'Mar 31, 2025', spend: '฿3.2M' },
  { name: 'Nordex Logistics', id: 'SUP-0103', category: 'Logistics', tier: 'Strategic', health: 88, owner: 'K. Hansen', primaryContact: 'Mali Kaewkamnerd', contactRole: 'Key Account Manager', lastEngagement: 'Sep 12, 2024', nextReview: 'Dec 10, 2024', openActions: 1, overdue: 0, renewal: 'Aug 31, 2025', spend: '฿96M' },
  { name: 'Fastener World', id: 'SUP-0124', category: 'Mechanical', tier: 'Preferred', health: 93, owner: 'S. Chen', primaryContact: 'Nattaya Wongsakul', contactRole: 'Sales Director', lastEngagement: 'Sep 3, 2024', nextReview: 'Nov 28, 2024', openActions: 0, overdue: 0, renewal: 'Oct 31, 2025', spend: '฿41M' },
  { name: 'BlueSky Plastics', id: 'SUP-0139', category: 'Packaging', tier: 'Preferred', health: 66, owner: 'M. Patel', primaryContact: 'Suda Thongchai', contactRole: 'Commercial Manager', lastEngagement: 'Aug 22, 2024', nextReview: 'Oct 15, 2024', openActions: 3, overdue: 1, renewal: 'Jan 31, 2025', spend: '฿58M' },
  { name: 'SteelForce Europe', id: 'SUP-0142', category: 'Raw Materials', tier: 'Development', health: 38, owner: 'L. Torres', primaryContact: 'Thanakorn Vongvanich', contactRole: 'Chairman', lastEngagement: 'Jul 12, 2024', nextReview: 'Overdue', openActions: 4, overdue: 3, renewal: 'Dec 31, 2024', spend: '฿27M' },
];

const healthTone = (health: number): Tone => (health >= 80 ? 'success' : health >= 60 ? 'warning' : 'danger');


export default function Relationship() {
  const { navigate, openSupplier, focusSupplierId } = useNavigation();
  const [selected, setSelected] = useState<RelationshipCompany | null>(() => companies.find(company => company.id === focusSupplierId) ?? null);
  const [search, setSearch] = useState('');
  const filtered = companies.filter(company => {
    const term = search.toLowerCase();
    return company.name.toLowerCase().includes(term) || company.id.toLowerCase().includes(term) || supplierProfiles[company.id].contacts.some(contact => contact.name.toLowerCase().includes(term)) || flattenOrg(orgStructures[company.id]).some(node => node.name.toLowerCase().includes(term));
  });
  const openSupplierProfile = (id: string) => {
    const supplier = suppliers.find(item => item.id === id);
    if (supplier) openSupplier(supplier, 'Profile');
  };

  if (selected) {
    const profile = supplierProfiles[selected.id];
    const contacts = profile.contacts;
    const masterSupplier = suppliers.find(supplier => supplier.id === selected.id);
    const relatedSuppliers = suppliers.filter(supplier => supplier.category === selected.category && supplier.id !== selected.id);

    return (
      <Page>
        <Header breadcrumb={['Supplier Contacts & Relationship', 'Companies', selected.id]} title={selected.name} action={{ label: 'Open Supplier Profile', onClick: () => openSupplierProfile(selected.id) }} />
        <PageContent>
          <BackLink onClick={() => setSelected(null)}>Back to relationship portfolio</BackLink>

          <OrgChart key={selected.id} root={orgStructures[selected.id]} onOpenSupplier={openSupplierProfile} onStartOnboarding={() => navigate('onboarding')} />

          <Card className="overflow-hidden">
            <CardHeader title="Contact list" description={`${contacts.length} supplier stakeholders`} actions={<Button variant="link">+ Add contact</Button>} />
            <TableContainer>
              <Table minWidth={1100}>
                <HeadRow columns={['Contact', 'Department', 'Contact type', 'Email', 'Phone', 'Products & services', 'Plant / region coverage']} />
                <tbody>
                  {contacts.map(contact => (
                    <Tr key={contact.email}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar initials={contact.name.split(' ').map(word => word[0]).join('')} />
                          <CellStack primary={contact.name} tone="plain" secondary={contact.title} />
                        </div>
                      </Td>
                      <Td>{contact.department}</Td>
                      <Td><Badge tone={contactTone[contact.type]} small>{contact.type}</Badge></Td>
                      <Td><a href={`mailto:${contact.email}`} className="break-all text-brand-700 hover:underline">{contact.email}</a></Td>
                      <Td className="whitespace-nowrap">{contact.phone}</Td>
                      <Td className="text-ink-soft">{contact.products}</Td>
                      <Td className="text-ink-soft">{contact.region}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          </Card>

          <Card>
            <CardHeader title="Relationship signals" />
            <CardBody className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ['Responsiveness', 86, 'Strong'],
                ['Executive alignment', 45, 'Coverage gap'],
                ['Commitment delivery', 58, 'Declining'],
                ['Collaboration', 78, 'Stable'],
              ].map(signal => <div key={signal[0] as string}><div className="mb-1.5 flex justify-between"><span className="text-caption text-ink-soft">{signal[0]}</span><span className="text-caption text-ink-muted">{signal[2]}</span></div><ProgressBar value={signal[1] as number} tone={(signal[1] as number) >= 75 ? 'success' : (signal[1] as number) >= 55 ? 'warning' : 'danger'} label={signal[0] as string} /></div>)}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Business coverage & terms" />
            <CardBody>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Business category', masterSupplier?.category || selected.category],
                  ['Material group', masterSupplier?.materialGroup || 'Not provided by source'],
                  ['Products & services', masterSupplier?.productTypes?.join(', ') || 'Not provided by source'],
                  ['Plant / region coverage', [masterSupplier?.businessUnit, masterSupplier?.region].filter(Boolean).join(' · ') || 'Not provided by source'],
                  ['Payment terms', profile.paymentTerms],
                  ['Lead time', profile.leadTime],
                  ['MOQ', profile.moq],
                ].map(([label, value]) => <div key={label}><Eyebrow>{label}</Eyebrow><div className="mt-1 text-body text-ink-soft">{value}</div></div>)}
              </div>
              <div className="mt-5 border-t border-line-subtle pt-5">
                <Eyebrow>Other suppliers in category</Eyebrow><div className="mt-2 flex flex-wrap gap-2">{relatedSuppliers.length ? relatedSuppliers.map(supplier => <Button key={supplier.id} size="xs" onClick={() => openSupplier(supplier)}>{supplier.name} · {supplier.id}</Button>) : <span className="text-caption text-ink-muted">No related supplier records</span>}</div>
              </div>
            </CardBody>
          </Card>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <Header breadcrumb={['Supplier relationships']} title="Supplier Contacts & Relationship" />
      <PageContent>
        <KpiGrid cols={4}>
          <KpiCard label="Strategic relationships" value="126" note="Executive engagement required" tone="brand" />
          <KpiCard label="Relationships at risk" value="18" note="Health score below 60" tone="danger" />
          <KpiCard label="Overdue commitments" value="24" note="Across 15 suppliers" tone="warning" />
          <KpiCard label="Reviews due this month" value="31" note="8 not yet scheduled" />
        </KpiGrid>

        <Card className="overflow-hidden">
          <CardHeader
            title="Supplier relationship portfolio"
            description="Contacts, engagement cadence, commitments and commercial milestones"
            actions={
              <Toolbar actions={<ExportButton filename="slm-relationship-portfolio" columns={['Supplier ID', 'Company', 'Category', 'Tier', 'Relationship health', 'Primary contact', 'Contacts', 'Payment terms', 'Last engagement', 'Open actions', 'Overdue actions', 'Next review', 'Contract renewal']} rows={filtered.map(company => [company.id, company.name, company.category, company.tier, company.health, company.primaryContact, supplierProfiles[company.id].contacts.length, supplierProfiles[company.id].paymentTerms, company.lastEngagement, company.openActions, company.overdue, company.nextReview, company.renewal])} />}>
                <SearchInput value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-56" placeholder="Search company, group or contact..." />
                <Select aria-label="Filter by relationship health"><option>All relationship health</option><option>Healthy</option><option>Needs attention</option><option>At risk</option></Select>
              </Toolbar>
            }
          />
          <TableContainer>
            <Table minWidth={1520}>
              <HeadRow columns={['Company', 'Group structure', 'Tier', 'Relationship health', 'Primary contact', 'Contact coverage', 'Commercial terms', 'Last engagement', 'Open actions', 'Next review', 'Contract renewal', '']} />
              <tbody>
                {filtered.map(company => {
                  const profile = supplierProfiles[company.id];
                  const gaps = coverageGaps(profile.contacts);
                  const group = orgStructures[company.id];
                  const groupEntities = flattenOrg(group).filter(node => node.relation !== 'Plant / branch');
                  return (
                  <Tr key={company.id} onClick={() => setSelected(company)}>
                    <Td><CellStack primary={company.name} secondary={`${company.id} · ${company.category} · ${company.spend}`} /></Td>
                    <Td><CellStack primary={group.name} tone="plain" secondary={`${groupEntities.length} entities · ${groupEntities.filter(node => !node.supplierId).length} not in SLM`} /></Td>
                    <Td>{company.tier}</Td>
                    <Td>
                      <div className={cx('text-sm font-semibold tabular-nums', toneText[healthTone(company.health)])}>{company.health}</div>
                      <ProgressBar value={company.health} tone={healthTone(company.health)} label={`${company.name} relationship health`} className="mt-1 w-16" />
                    </Td>
                    <Td><CellStack primary={company.primaryContact} tone="plain" secondary={`${company.contactRole} · ${profile.contacts[0].phone}`} /></Td>
                    <Td>
                      <div className="text-caption font-medium text-ink-soft">{profile.contacts.length} contacts</div>
                      <div className={cx('mt-0.5 text-caption', gaps.length ? 'text-warning-700' : 'text-success-700')}>{gaps.length ? `Gap: ${gaps.join(', ')}` : 'Full coverage'}</div>
                    </Td>
                    <Td><CellStack primary={profile.paymentTerms} tone="plain" secondary={`${profile.leadTime} · MOQ ${profile.moq}`} /></Td>
                    <Td className="whitespace-nowrap text-ink-muted">{company.lastEngagement}</Td>
                    <Td><span className={cx('font-semibold', company.overdue ? 'text-danger-700' : 'text-ink-soft')}>{company.openActions}{company.overdue ? ` · ${company.overdue} overdue` : ''}</span></Td>
                    <Td className={cx('whitespace-nowrap', company.nextReview === 'Overdue' ? 'font-semibold text-danger-700' : '')}>{company.nextReview}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{company.renewal}</Td>
                    <Td><Button variant="link" className="whitespace-nowrap" onClick={() => setSelected(company)}>Open workspace <ArrowRightIcon className="h-3.5 w-3.5" /></Button></Td>
                  </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
          {filtered.length === 0 && <EmptyState title="No companies match this search" />}
        </Card>
      </PageContent>
    </Page>
  );
}
