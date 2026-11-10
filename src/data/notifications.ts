import type { Screen } from '../types';
import type { Tone } from '../components/ui';

type NotificationCategory = 'Risk' | 'Integration' | 'Corrective action' | 'Approval' | 'Compliance' | 'Qualification' | 'Onboarding' | 'Task' | 'Access' | 'Sourcing';
type NotificationTarget = { screen: Screen; section?: string; supplierId?: string; tab?: string };
export type AppNotification = { id: string; category: NotificationCategory; tone: Tone; title: string; detail: string; time: string; unread: boolean; target: NotificationTarget };

// MOCK: Admin notifications until an event feed exists. Supplier IDs match the supplier master.
const seed: AppNotification[] = [
  { id: 'n1', category: 'Risk', tone: 'danger', title: 'Titan Industries risk raised to Critical', detail: 'Risk score is now 78. Escalate to the risk manager.', time: '10 min ago', unread: true, target: { screen: 'supplier360', supplierId: 'SUP-0012', tab: 'Risk' } },
  { id: 'n2', category: 'Integration', tone: 'danger', title: 'Supplier Portal sync failed', detail: 'A task assignment could not be delivered. A retry is queued.', time: '25 min ago', unread: true, target: { screen: 'administration' } },
  { id: 'n3', category: 'Corrective action', tone: 'danger', title: 'CAR-2024-118 is overdue', detail: 'Titan Industries has not submitted a corrective action plan.', time: '1 h ago', unread: true, target: { screen: 'car' } },
  { id: 'n4', category: 'Approval', tone: 'warning', title: '3 approvals waiting more than 3 days', detail: 'Qualification and capability decisions are past the expected turnaround.', time: '2 h ago', unread: true, target: { screen: 'qualification', section: 'pending' } },
  { id: 'n5', category: 'Compliance', tone: 'warning', title: 'ISO certificate expired for Titan Industries', detail: 'The uploaded certificate was returned. A renewed file is required.', time: '3 h ago', unread: true, target: { screen: 'supplier360', supplierId: 'SUP-0012', tab: 'Compliance' } },
  { id: 'n6', category: 'Qualification', tone: 'warning', title: 'Qualifications expiring within 60 days', detail: 'Plan requalification before the validity ends.', time: 'Yesterday', unread: false, target: { screen: 'qualification', section: 'requalification' } },
  { id: 'n7', category: 'Onboarding', tone: 'info', title: 'Apex Components onboarding completed', detail: 'Awaiting approval before the supplier is activated.', time: 'Yesterday', unread: false, target: { screen: 'onboarding' } },
  { id: 'n8', category: 'Task', tone: 'info', title: 'Supplier task submitted for review', detail: 'Company profile update from Apex Components.', time: 'Yesterday', unread: false, target: { screen: 'tasks' } },
  { id: 'n9', category: 'Access', tone: 'warning', title: '2 access requests pending', detail: 'New users are waiting for a role to be assigned.', time: '2 days ago', unread: false, target: { screen: 'administration' } },
  { id: 'n10', category: 'Sourcing', tone: 'info', title: 'Fastener World moved to Selected', detail: 'The sourcing team chose this supplier.', time: '2 days ago', unread: false, target: { screen: 'suppliers' } },
];

let items: AppNotification[] = structuredClone(seed);
let revision = 0;
const listeners = new Set<() => void>();
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

export const subscribeNotifications = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getNotificationRevision = () => revision;
export const listNotifications = () => items;
export const unreadCount = () => items.filter(item => item.unread).length;
export function markRead(id: string) { items = items.map(item => (item.id === id ? { ...item, unread: false } : item)); notify(); }
export function markAllRead() { items = items.map(item => ({ ...item, unread: false })); notify(); }
