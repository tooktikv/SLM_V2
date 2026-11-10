export type Screen =
  | 'dashboard'
  | 'suppliers'
  | 'supplier360'
  | 'onboarding'
  | 'tasks'
  | 'qualification'
  | 'qsl'
  | 'risk'
  | 'performance'
  | 'audit'
  | 'car'
  | 'compliance'
  | 'relationship'
  | 'analytics'
  | 'administration';

export type CarDraft = { supplier: string; audit: string; finding: string; issue: string; severity: string; owner: string };

export type CarTarget = { carId: string } | { draft: CarDraft };

