import type { Actor, AssessmentForm, Criteria, CriteriaData, CriteriaGroup, CriteriaKind, FormData, FormItem } from '../types.ts';
import { audit, clone, getStore, nextId } from '../store.ts';
import { assertCan } from '../rbac.ts';
import { fail, requireValid } from '../errors.ts';
import { auditVersioned, findOrFail, latestVersion, newVersioned, publishLatest, publishedVersion, saveDraft } from '../versioning.ts';

const ANSWER_TYPES = ['ShortText', 'LongText', 'Choice', 'Number', 'Date', 'File'];

// ---------------------------------------------------------------- Groups (Skill)

export function createCriteriaGroup(actor: Actor, name: string): CriteriaGroup {
  assertCan(actor, 'settings.manage');
  const store = getStore();
  if (!name?.trim()) fail('VALIDATION', 'Please enter a skill name');
  if (store.criteriaGroups.some(group => group.name.toLowerCase() === name.trim().toLowerCase())) fail('DUPLICATE', 'This skill already exists');
  const group = { id: nextId('GRP'), name: name.trim(), active: true };
  store.criteriaGroups.push(group);
  audit(actor, { action: 'Criteria group created', recordType: 'CriteriaGroup', recordRef: group.id, next: group });
  return clone(group);
}

// ---------------------------------------------------------------- Criteria

function validateCriteria(data: CriteriaData, selfId?: string): string[] {
  const store = getStore();
  const errors: string[] = [];
  if (!data.code?.trim()) errors.push('Please enter a criteria code');
  if (store.criteria.some(item => item.id !== selfId && item.versions.some(v => v.data.code.toLowerCase() === data.code?.trim().toLowerCase()))) errors.push('Duplicate criteria code');
  if (!data.name?.trim()) errors.push('Please enter a criteria name');
  if (!store.criteriaGroups.some(group => group.id === data.groupId)) errors.push('Please select a skill');
  if (!ANSWER_TYPES.includes(data.answerType)) errors.push('Invalid answer type');
  if (data.answerType === 'Choice' && (data.options?.length ?? 0) < 2) errors.push('Choice answers need at least 2 options');
  if (data.levels.some(text => !text?.trim())) errors.push('Please enter descriptions for Level 1-3');
  return errors;
}

const findCriteria = (id: string) => findOrFail(getStore().criteria, id, 'Criteria');

// Standard criteria belong to the central authority; buyer custom criteria stay separate and may not overwrite them.
const guardKind = (actor: Actor, kind: CriteriaKind) => assertCan(actor, kind === 'Standard' ? 'criteria.standard' : 'criteria.custom');

export function createCriteria(actor: Actor, data: CriteriaData, kind: CriteriaKind = 'Standard'): Criteria {
  guardKind(actor, kind);
  requireValid(validateCriteria(data));
  const criteria: Criteria = { ...newVersioned(nextId(kind === 'Standard' ? 'STD' : 'CUS'), data, actor), kind };
  publishLatest(criteria, actor);
  getStore().criteria.push(criteria);
  audit(actor, { action: kind === 'Standard' ? 'Standard criteria created' : 'Buyer custom criteria created', recordType: 'Criteria', recordRef: criteria.id, next: criteria });
  return clone(criteria);
}

// Saving always creates a new version; rounds that used an earlier version keep it.
export function updateCriteria(actor: Actor, id: string, patch: Partial<CriteriaData>): Criteria {
  const criteria = findCriteria(id);
  guardKind(actor, criteria.kind);
  const before = clone(criteria);
  const data = { ...latestVersion(criteria).data, ...patch };
  requireValid(validateCriteria(data, id));
  saveDraft(criteria, data, actor);
  publishLatest(criteria, actor);
  auditVersioned(actor, 'Criteria saved as new version', 'Criteria', criteria, before);
  return clone(criteria);
}

export function criteriaUsage(id: string): { forms: number; assessments: number } {
  const store = getStore();
  return {
    forms: store.forms.filter(form => form.versions.some(v => v.data.sections.some(section => section.items.some(item => item.criteriaId === id)))).length,
    assessments: store.snapshots.filter(snapshot => snapshot.criteria.some(item => item.id === id)).length,
  };
}

export function setCriteriaActive(actor: Actor, id: string, active: boolean): Criteria {
  const criteria = findCriteria(id);
  guardKind(actor, criteria.kind);
  const before = clone(criteria);
  criteria.active = active;
  auditVersioned(actor, active ? 'Criteria activated' : 'Criteria deactivated', 'Criteria', criteria, before);
  return clone(criteria);
}

// BR-18: a criteria that has been used cannot be deleted, only deactivated.
export function deleteCriteria(actor: Actor, id: string): void {
  const criteria = findCriteria(id);
  guardKind(actor, criteria.kind);
  const usage = criteriaUsage(id);
  if (usage.forms || usage.assessments) fail('VALIDATION', 'Already in use; cannot be deleted to preserve history');
  const store = getStore();
  store.criteria = store.criteria.filter(item => item.id !== id);
  audit(actor, { action: 'Criteria deleted', recordType: 'Criteria', recordRef: id, previous: criteria });
}

// ---------------------------------------------------------------- Forms

export type FormInput = { code: string; name: string; categories: string[]; sections: { title: string; items: { criteriaId: string; required: boolean }[] }[]; validityMonths?: number };

// Items pin the criteria version that is published when the form is saved.
function pinForm(input: FormInput): FormData {
  return {
    ...input,
    sections: input.sections.map(section => ({
      title: section.title,
      items: section.items.map((item): FormItem => ({ ...item, criteriaVersion: publishedVersion(findCriteria(item.criteriaId))?.version ?? 0 })),
    })),
  };
}

function validateForm(data: FormData, selfId?: string): string[] {
  const store = getStore();
  const errors: string[] = [];
  if (!data.name?.trim() || !data.code?.trim()) errors.push('Please enter the assessment form name and code');
  if (store.forms.some(form => form.id !== selfId && form.versions.some(v => v.data.code === data.code))) errors.push('Duplicate assessment form code');
  if (!data.categories.length || data.categories.some(name => !store.categories.some(category => category.name === name))) errors.push('Please select the categories it applies to');
  const items = data.sections.flatMap(section => section.items);
  if (!items.length) errors.push('At least 1 question is required');
  if (new Set(items.map(item => item.criteriaId)).size !== items.length) errors.push('Duplicate criteria in the assessment form');
  items.forEach(item => {
    const criteria = store.criteria.find(entry => entry.id === item.criteriaId);
    if (!criteria || !criteria.active || !item.criteriaVersion) errors.push(`Criteria ${item.criteriaId} is not available`);
  });
  if (data.validityMonths !== undefined && (!Number.isInteger(data.validityMonths) || data.validityMonths < 1 || data.validityMonths > 60)) errors.push('Validity must be between 1 and 60 months');
  return errors;
}

export function createForm(actor: Actor, input: FormInput): AssessmentForm {
  assertCan(actor, 'settings.manage');
  const data = pinForm(input);
  requireValid(validateForm(data));
  const form = newVersioned(nextId('FRM'), data, actor);
  getStore().forms.push(form);
  audit(actor, { action: 'Assessment form created', recordType: 'AssessmentForm', recordRef: form.id, next: form });
  return clone(form);
}

// Editing an active form opens a new draft version; the active version keeps serving new requests (BR-14).
export function updateForm(actor: Actor, id: string, input: FormInput): AssessmentForm {
  assertCan(actor, 'settings.manage');
  const form = findOrFail(getStore().forms, id, 'Assessment form');
  const before = clone(form);
  const data = pinForm(input);
  requireValid(validateForm(data, id));
  saveDraft(form, data, actor);
  auditVersioned(actor, 'Assessment form saved as draft', 'AssessmentForm', form, before);
  return clone(form);
}

// Only one version of a form is active at a time; activating supersedes the older one.
export function activateForm(actor: Actor, id: string): AssessmentForm {
  assertCan(actor, 'settings.manage');
  const form = findOrFail(getStore().forms, id, 'Assessment form');
  requireValid(validateForm(latestVersion(form).data, id));
  const before = clone(form);
  publishLatest(form, actor);
  form.active = true;
  auditVersioned(actor, 'Assessment form activated', 'AssessmentForm', form, before);
  return clone(form);
}

// Adds a criteria to a form as a new active version; rounds already submitted keep the earlier version.
export function addCriteriaToForm(actor: Actor, formId: string, criteriaId: string, input: { section: string; required: boolean }): AssessmentForm {
  const criteria = findCriteria(criteriaId);
  guardKind(actor, criteria.kind);
  const form = findOrFail(getStore().forms, formId, 'Assessment form');
  const current = clone((publishedVersion(form) ?? latestVersion(form)).data);
  if (current.sections.some(section => section.items.some(item => item.criteriaId === criteriaId))) fail('DUPLICATE', 'This criteria is already in the assessment form');
  const item: FormItem = { criteriaId, criteriaVersion: publishedVersion(criteria)?.version ?? 0, required: input.required };
  const section = current.sections.find(entry => entry.title === input.section);
  if (section) section.items.push(item);
  else current.sections.push({ title: input.section, items: [item] });
  requireValid(validateForm(current, formId));
  const before = clone(form);
  saveDraft(form, current, actor);
  publishLatest(form, actor);
  auditVersioned(actor, 'Criteria added to assessment form', 'AssessmentForm', form, before);
  return clone(form);
}
