import type { ComponentType } from 'react';
import type { Screen } from './types';
import type { Role } from './qsl/types';
import { qualificationSections } from './qsl/rbac';
import {
  BadgeCheckIcon, BarChartIcon, BuildingIcon, ClipboardCheckIcon, DashboardIcon, FileSearchIcon, SettingsIcon, ShieldAlertIcon, TrendingUpIcon, UserPlusIcon, UsersIcon, WrenchIcon,
  type IconProps,
} from './components/icons';

export type SectionDef = { id: string; label: string; group?: string };
export type ModuleDef = {
  id: Exclude<Screen, 'supplier360'>;
  no?: number;
  label: string;
  group: string;
  Icon: ComponentType<IconProps>;
  sections?: (role: Role) => SectionDef[];
};

const qualificationLabels: Record<string, SectionDef> = {
  pending: { id: 'pending', label: 'Supplier Qualification List' },
  qualified: { id: 'qualified', label: 'Supplier Qualified List' },
  requalification: { id: 'requalification', label: 'Requalification' },
};

const fixed = (...items: SectionDef[]) => () => items;

// The SLM modules in specification order.
export const modules: ModuleDef[] = [
  {
    id: 'dashboard', no: 1, label: 'Dashboard & Report', group: 'Overview', Icon: DashboardIcon,
  },
  {
    id: 'onboarding', no: 2, label: 'Supplier Onboarding', group: 'Supplier lifecycle', Icon: UserPlusIcon,
    sections: fixed({ id: 'register', label: 'Onboarding Register' }, { id: 'samples', label: 'Sample Request Tracking' }),
  },
  {
    id: 'suppliers', no: 3, label: 'Supplier Management', group: 'Supplier lifecycle', Icon: BuildingIcon,
  },
  {
    id: 'qualification', no: 4, label: 'Qualification & Capability', group: 'Supplier lifecycle', Icon: BadgeCheckIcon,
    sections: role => qualificationSections(role).map(id => qualificationLabels[id]),
  },
  {
    id: 'risk', no: 6, label: 'Risk Management', group: 'Monitor', Icon: ShieldAlertIcon,
  },
  {
    id: 'compliance', no: 7, label: 'Compliance & Monitoring', group: 'Monitor', Icon: ClipboardCheckIcon,
  },
  { id: 'performance', no: 8, label: 'Performance Management', group: 'Monitor', Icon: TrendingUpIcon },
  { id: 'relationship', no: 9, label: 'Contacts & Relationship', group: 'Relationships', Icon: UsersIcon },
  { id: 'audit', no: 10, label: 'Audit & Assessment', group: 'Improve', Icon: FileSearchIcon },
  { id: 'car', no: 11, label: 'Corrective Action', group: 'Improve', Icon: WrenchIcon },
  {
    id: 'analytics', no: 12, label: 'Report & Analytics', group: 'Platform', Icon: BarChartIcon,
  },
  { id: 'administration', no: 13, label: 'Administration & Settings', group: 'Platform', Icon: SettingsIcon },
];

const findModule = (screen: Screen): ModuleDef | undefined => modules.find(item => item.id === (screen === 'supplier360' ? 'suppliers' : screen));

export const sectionsOf = (screen: Screen, role: Role): SectionDef[] => findModule(screen)?.sections?.(role) ?? [];

// Resolves a requested section to one the role can see, falling back to the first.
// Single-page modules keep the request so a deep link can pick a tab.
export function resolveSection(screen: Screen, role: Role, requested?: string): string {
  const list = sectionsOf(screen, role);
  if (!list.length) return requested ?? '';
  return list.find(item => item.id === requested)?.id ?? list[0]?.id ?? '';
}

export const sectionLabel = (screen: Screen, role: Role, section: string) => sectionsOf(screen, role).find(item => item.id === section)?.label;
