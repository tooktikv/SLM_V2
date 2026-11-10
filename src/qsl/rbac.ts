import type { Actor, Qsl, Role } from './types.ts';
import { fail } from './errors.ts';

export type Permission =
  | 'qsl.create' | 'qsl.fill' | 'qsl.prereview' | 'qsl.assess' | 'qsl.approve' | 'qsl.publish' | 'enrollment.manage' | 'monitoring.manage'
  | 'criteria.standard' | 'criteria.custom' | 'settings.manage' | 'directory.view' | 'audit.view';

// Admin holds every permission in this mockup so the whole system can be explored from one view.
const grants: Record<Permission, Role[]> = {
  'qsl.create': ['Coordinator', 'Admin'],
  'qsl.fill': ['Supplier', 'Admin'],
  'qsl.prereview': ['Coordinator', 'Admin'],
  'qsl.assess': ['Assessor', 'Admin'],
  'qsl.approve': ['Approver', 'Admin'],
  'qsl.publish': ['Coordinator', 'Approver', 'Admin'],
  'enrollment.manage': ['Coordinator', 'Approver', 'Admin'],
  'monitoring.manage': ['Approver', 'Admin'],
  'criteria.standard': ['Admin'],
  'criteria.custom': ['Coordinator', 'Admin'],
  'settings.manage': ['Admin'],
  'directory.view': ['Coordinator', 'Assessor', 'Approver', 'Buyer', 'Admin'],
  'audit.view': ['Admin'],
};

export const can = (actor: Actor, permission: Permission) => grants[permission].includes(actor.role);
export const rolesFor = (permission: Permission): Role[] => [...grants[permission]];

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) fail('FORBIDDEN', `Role ${actor.role} is not allowed to do this (${permission})`);
}

const canAccessSupplier = (actor: Actor, supplierId: string) => actor.role !== 'Supplier' || (actor.supplierIds ?? []).includes(supplierId);

// Visibility: suppliers see their own company without drafts; assessors and approvers their assignments;
// buyers only completed rounds.
export function canViewQsl(actor: Actor, qsl: Qsl): boolean {
  switch (actor.role) {
    case 'Supplier': return canAccessSupplier(actor, qsl.supplierId) && qsl.status !== 'Draft';
    case 'Assessor': return qsl.assessorId === actor.id && qsl.status !== 'Draft';
    case 'Approver': return qsl.approverId === actor.id && (qsl.status === 'WaitingApproval' || qsl.status === 'Completed' || qsl.approvals.length > 0);
    case 'Buyer': return qsl.status === 'Completed';
    default: return true;
  }
}

export function assertView(actor: Actor, qsl: Qsl): void {
  if (!canViewQsl(actor, qsl)) fail('FORBIDDEN', 'Record not found or access denied');
}

// pending = waiting for qualification, qualified = passed (with capability and history), requalification = expired and redone.
export type QualificationSection = 'pending' | 'qualified' | 'requalification';

export function qualificationSections(role: Role): QualificationSection[] {
  switch (role) {
    case 'Coordinator': case 'Admin': case 'Approver': return ['pending', 'qualified', 'requalification'];
    case 'Supplier': case 'Assessor': return ['pending', 'qualified'];
    case 'Buyer': return ['qualified'];
  }
}
