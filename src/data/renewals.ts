import { useSyncExternalStore } from 'react';
import { complianceCompanies, type ComplianceGroup, type ComplianceItem } from './compliance';

// The compliance mock data is dated relative to this day.
export const complianceToday = '2024-09-10';

export type RenewalChannel = 'Supplier Portal' | 'Email';
export type RenewalRequest = {
  id: string;
  supplierId: string;
  itemName: string;
  group: ComplianceGroup;
  kind: 'Renewal' | 'Upload';
  requestedOn: string;
  respondBy: string;
  channel: RenewalChannel;
  message: string;
  status: 'Requested' | 'Received';
  receivedOn?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const display = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return `${MONTHS[month - 1]} ${day}, ${year}`; };
export const isoAfterToday = (days: number) => new Date(Date.parse(`${complianceToday}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const requests: RenewalRequest[] = [
  { id: 'RN-0001', supplierId: 'SUP-0012', itemName: 'Public Liability Insurance', group: 'Documents', kind: 'Renewal', requestedOn: 'Sep 2, 2024', respondBy: 'Sep 24, 2024', channel: 'Supplier Portal', message: 'Please upload the renewed Public Liability Insurance certificate. The current one expires on Oct 8, 2024.', status: 'Requested' },
];

let revision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

// Re-renders the caller whenever a renewal request changes; read data inside render.
export const useRenewals = (): number => useSyncExternalStore(subscribe, () => revision);

export const renewalFor = (supplierId: string, item: ComplianceItem): RenewalRequest | undefined =>
  requests.find(request => request.status === 'Requested' && request.supplierId === supplierId && request.itemName === item.name && request.group === item.group);

export const openRenewalCount = () => requests.filter(request => request.status === 'Requested').length;

export const renewalKind = (item: ComplianceItem): RenewalRequest['kind'] => (item.status === 'Missing' || item.status === 'No data received' ? 'Upload' : 'Renewal');

export const defaultRenewalMessage = (item: ComplianceItem) =>
  renewalKind(item) === 'Upload'
    ? `Please upload the ${item.name}. No document is on file.`
    : `Please upload the renewed ${item.name}. The current one ${item.status === 'Expired' ? 'expired' : 'expires'} on ${item.expiry}.`;

export type RenewalInput = { supplierId: string; item: ComplianceItem; respondBy: string; channel: RenewalChannel; message: string };

export function requestRenewal(input: RenewalInput): RenewalRequest {
  if (!input.respondBy) throw new Error('Please select a respond-by date');
  if (!input.message.trim()) throw new Error('Please enter a message for the supplier');
  if (renewalFor(input.supplierId, input.item)) throw new Error('A renewal request is already open for this document');
  const request: RenewalRequest = {
    id: `RN-${String(requests.length + 1).padStart(4, '0')}`,
    supplierId: input.supplierId,
    itemName: input.item.name,
    group: input.item.group,
    kind: renewalKind(input.item),
    requestedOn: display(complianceToday),
    respondBy: display(input.respondBy),
    channel: input.channel,
    message: input.message.trim(),
    status: 'Requested',
  };
  requests.push(request);
  notify();
  return request;
}

// Demo shortcut for the supplier uploading the renewed document: the document becomes valid for another year.
export function markRenewalReceived(request: RenewalRequest) {
  const item = complianceCompanies.find(company => company.id === request.supplierId)?.items.find(entry => entry.name === request.itemName && entry.group === request.group);
  request.status = 'Received';
  request.receivedOn = display(complianceToday);
  if (item) {
    item.status = 'Verified';
    item.daysLeft = 365;
    item.expiry = display(isoAfterToday(365));
  }
  notify();
}
