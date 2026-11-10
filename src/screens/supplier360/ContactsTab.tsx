import type { Supplier } from '../../data/suppliers';
import { contactTone, coverageGaps, supplierProfiles } from '../../data/contacts';
import { useNavigation } from '../../NavigationContext';
import { Avatar, Badge, Button, Callout, Card, CardBody, CardHeader, CellStack, DetailGrid, EmptyState, HeadRow, KpiCard, KpiGrid, Table, TableContainer, Td, Tr } from '../../components/ui';

// Supplier stakeholders from Contacts & Relationship, shown inside the supplier profile.
export default function ContactsTab({ supplier }: { supplier: Supplier }) {
  const { navigate } = useNavigation();
  const profile = supplierProfiles[supplier.id];
  const openRelationship = () => navigate('relationship', undefined, supplier.id);

  if (!profile) {
    return (
      <Card>
        <EmptyState title="No contacts recorded" description="No stakeholders have been added for this supplier yet." action={<Button onClick={openRelationship}>Open Contacts & Relationship</Button>} />
      </Card>
    );
  }

  const { contacts } = profile;
  const gaps = coverageGaps(contacts);
  const primary = contacts.find(contact => contact.type === 'Primary');

  return (
    <div className="space-y-5">
      <KpiGrid cols={4}>
        <KpiCard label="Contacts" value={contacts.length} note="Supplier stakeholders" tone="brand" size="md" />
        <KpiCard label="Primary contact" value={primary?.name ?? '—'} note={primary?.title ?? 'Not set'} size="md" />
        <KpiCard label="Coverage" value={gaps.length ? `${gaps.length} gap${gaps.length > 1 ? 's' : ''}` : 'Complete'} note={gaps.length ? `Missing ${gaps.join(', ').toLowerCase()}` : 'Executive sponsor and finance recorded'} tone={gaps.length ? 'warning' : 'success'} size="md" />
        <KpiCard label="Payment terms" value={profile.paymentTerms} note={`Lead time ${profile.leadTime}`} size="md" />
      </KpiGrid>

      <Card className="overflow-hidden">
        <CardHeader title="Contact list" description={`${contacts.length} stakeholders`} actions={<Button variant="link" onClick={openRelationship}>Open Contacts & Relationship</Button>} />
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
                  <Td className="whitespace-nowrap"><a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:underline">{contact.phone}</a></Td>
                  <Td className="text-ink-soft">{contact.products}</Td>
                  <Td className="text-ink-soft">{contact.region}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        {gaps.length > 0 && <div className="border-t border-line-subtle p-4"><Callout tone="warning" title="Coverage gap" compact>No {gaps.join(' or ').toLowerCase()} contact is recorded.</Callout></div>}
      </Card>

      <Card>
        <CardHeader title="Commercial terms" description="Agreed with the supplier" />
        <CardBody><DetailGrid columns={2} items={[{ label: 'Payment terms', value: profile.paymentTerms }, { label: 'Lead time', value: profile.leadTime }, { label: 'Minimum order quantity', value: profile.moq }]} /></CardBody>
      </Card>
    </div>
  );
}
