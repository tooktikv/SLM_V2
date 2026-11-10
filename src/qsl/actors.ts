import type { Actor, Role } from './types.ts';

// MOCK identities: the project has no authentication yet, so each role is a fixed demo user.
export const staff = {
  coordinator: { id: 'USR-C1', name: 'Anong Sriwan', role: 'Coordinator' },
  assessor: { id: 'USR-A1', name: 'Daniel Okoye', role: 'Assessor' },
  assessor2: { id: 'USR-A2', name: 'Mei Tanaka', role: 'Assessor' },
  approver: { id: 'USR-P1', name: 'Sofia Alvarez', role: 'Approver' },
  approver2: { id: 'USR-P2', name: 'Henrik Larsen', role: 'Approver' },
  buyer: { id: 'USR-B1', name: 'Priya Nair', role: 'Buyer' },
  admin: { id: 'USR-ADM', name: 'Marcus Patel', role: 'Admin' },
} satisfies Record<string, Actor>;

export const supplierActor = (supplierId: string, name = `Supplier user (${supplierId})`): Actor => ({ id: `USR-SUP-${supplierId}`, name, role: 'Supplier', supplierIds: [supplierId] });

// Role switcher for the demo. SUP-0034 is the supplier used for the supplier view.
export const demoActors: Record<Role, Actor> = {
  Supplier: supplierActor('SUP-0034', 'Apex Components user'),
  Coordinator: staff.coordinator,
  Assessor: staff.assessor,
  Approver: staff.approver,
  Buyer: staff.buyer,
  Admin: staff.admin,
};

let current: Actor = demoActors.Admin;
export const getCurrentActor = (): Actor => current;
