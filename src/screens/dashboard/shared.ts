import { suppliers, type Supplier } from '../../data/suppliers';

// MOCK banner text shown on the dashboard pages.
export const mockNote = 'Demo data for the Admin full-access prototype. It is replaced by live records once the backend is connected.';

export const findSupplierByName = (name: string): Supplier | undefined =>
  suppliers.find(item => item.name === name || item.name.startsWith(name) || name.startsWith(item.name) || item.name.split(' ')[0] === name.split(' ')[0]);

export type DisplayStatus = 'Active' | 'Pending' | 'Inactive' | 'Suspended';
export const displayStatuses: DisplayStatus[] = ['Active', 'Pending', 'Inactive', 'Suspended'];

// Suspension comes from the QSL standing; Draft and Rejected suppliers are shown as Inactive.
export function displayStatus(supplier: Supplier, suspendedIds: Set<string>): DisplayStatus {
  if (suspendedIds.has(supplier.id)) return 'Suspended';
  if (supplier.status === 'Active') return 'Active';
  if (supplier.status === 'Pending') return 'Pending';
  return 'Inactive';
}

export const buyerOf = (supplier: Supplier) => supplier.businessUnit ?? 'Unassigned';

export const countBy = <T,>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, number>();
  items.forEach(item => map.set(key(item), (map.get(key(item)) ?? 0) + 1));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
