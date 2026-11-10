import type { Actor, ProcessSettings } from './types.ts';
import { audit, clone, getStore, nowIso } from './store.ts';
import { assertCan } from './rbac.ts';
import { requireValid } from './errors.ts';

export const getSettings = (): ProcessSettings => clone(getStore().settings);

function validateSettings(next: ProcessSettings): string[] {
  const store = getStore();
  const errors: string[] = [];
  const lists: [keyof Pick<ProcessSettings, 'coordinatorIds' | 'assessorIds' | 'approverIds'>, string, string][] = [
    ['coordinatorIds', 'Coordinator', 'Coordinator'], ['assessorIds', 'Assessor', 'Assessor'], ['approverIds', 'Approver', 'Approver'],
  ];
  lists.forEach(([key, role, label]) => {
    if (!next[key].length) errors.push(`At least 1 ${label} is required`);
    if (next[key].some(id => store.users.find(user => user.id === id)?.role !== role)) errors.push(`Invalid ${label} list`);
  });
  Object.entries(next.validityMonthsByCategory).forEach(([category, months]) => {
    if (!Number.isInteger(months) || months < 1 || months > 60) errors.push(`Validity for category ${category} must be between 1 and 60 months`);
  });
  if (!Number.isInteger(next.reminderDays) || next.reminderDays <= 0) errors.push('Reminder days must be greater than 0');
  // Score and Level decision methods are still "To Confirm" in the spec.
  if (next.decisionMethod !== 'PassFail') errors.push('Score or Level decision method is pending CPF confirmation');
  return errors;
}

// Settings apply to new requests and approvals only; stored expiry dates are never recomputed (BR-17).
export function updateSettings(actor: Actor, patch: Partial<ProcessSettings>): ProcessSettings {
  assertCan(actor, 'settings.manage');
  const store = getStore();
  const next = { ...store.settings, ...patch };
  requireValid(validateSettings(next));
  const previous = clone(store.settings);
  store.settings = clone(next);
  store.settingsHistory.push({ at: nowIso(), by: actor.id, summary: Object.keys(patch).join(', ') });
  audit(actor, { action: 'Process settings changed', recordType: 'ProcessSettings', recordRef: 'SETTINGS', previous, next });
  return getSettings();
}

export const validityMonthsFor = (category: string, formMonths?: number): number =>
  formMonths ?? getStore().settings.validityMonthsByCategory[category] ?? 12;
