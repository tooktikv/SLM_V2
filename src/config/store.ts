import { ADMIN_ROLES, REVIEWER_ROLES, defaultConfig } from './defaults.ts';
import type { ConfigChange, ConfigSection, ConfigState, ListKey } from './types.ts';

export class ConfigError extends Error {
  details: string[];
  constructor(details: string[]) {
    super(details[0] ?? 'Invalid configuration');
    this.name = 'ConfigError';
    this.details = details;
  }
}

let state: ConfigState = defaultConfig();
let changes: ConfigChange[] = [];
let revision = 0;
let counter = 0;
const listeners = new Set<() => void>();

export const getRevision = () => revision;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };

export function resetConfig(): void {
  state = defaultConfig();
  changes = [];
  counter = 0;
  notify();
}

export const getConfig = <K extends ConfigSection>(section: K): ConfigState[K] => structuredClone(state[section]);
export const listChanges = (): ConfigChange[] => [...changes].reverse();
export const newId = (prefix: string) => { counter += 1; return `${prefix}-${Date.now().toString(36)}${counter}`; };

const unique = (names: string[]) => new Set(names.map(name => name.trim().toLowerCase())).size === names.length;
const blank = (value: string | undefined) => !value || !value.trim();
const ints = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

type Validator<K extends ConfigSection> = (next: ConfigState[K], prev: ConfigState[K], all: ConfigState) => string[];
const validators: { [K in ConfigSection]: Validator<K> } = {
  general: next => [
    ...(['organization', 'legalEntity', 'timeZone', 'currency'] as const).filter(key => blank(next[key])).map(key => `${key} is required`),
  ],
  lists: (next, prev) => {
    const errors: string[] = [];
    (Object.keys(next) as ListKey[]).forEach(key => {
      if (next[key].some(item => blank(item.name))) errors.push('Names cannot be empty');
      if (!unique(next[key].map(item => item.name))) errors.push('Names must be unique within a list');
      prev[key].filter(item => item.locked).forEach(item => {
        const kept = next[key].find(entry => entry.id === item.id);
        if (!kept || kept.name !== item.name || !kept.active) errors.push(`"${item.name}" is a system value and cannot be changed or removed`);
      });
    });
    return [...new Set(errors)];
  },
  taskTypes: (next, _prev, all) => {
    const errors: string[] = [];
    if (next.some(item => blank(item.name)) || !unique(next.map(item => item.name))) errors.push('Task type names must be unique and not empty');
    next.forEach(item => {
      if (!ints(item.dueDays, 1, 365)) errors.push(`${item.name}: due days must be between 1 and 365`);
      if (!ints(item.reminderDaysBefore, 0, 365) || item.reminderDaysBefore > item.dueDays) errors.push(`${item.name}: reminder must be within the due period`);
      if (item.reviewWorkflow !== 'Auto-accept' && blank(item.reviewerRole)) errors.push(`${item.name}: reviewer is required`);
      if (item.reviewWorkflow === 'Two-step review' && (blank(item.secondReviewerRole) || item.secondReviewerRole === item.reviewerRole)) errors.push(`${item.name}: a second, different reviewer is required`);
      if (item.reviewWorkflow === 'Auto-accept' && item.allowReturn) errors.push(`${item.name}: auto-accepted tasks cannot be returned for correction`);
    });
    const used = new Set([...all.taskTemplates.map(entry => entry.taskTypeId), ...all.assignmentRules.map(entry => entry.taskTypeId)]);
    used.forEach(id => { if (!next.some(item => item.id === id)) errors.push('A task type that is used by a template or assignment rule cannot be removed'); });
    return [...new Set(errors)];
  },
  taskTemplates: (next, _prev, all) => {
    const errors: string[] = [];
    if (next.some(item => blank(item.name)) || !unique(next.map(item => item.name))) errors.push('Template names must be unique and not empty');
    next.forEach(item => { if (!all.taskTypes.some(type => type.id === item.taskTypeId && type.active)) errors.push(`${item.name}: choose an active task type`); });
    return errors;
  },
  assignmentRules: (next, _prev, all) => {
    const errors: string[] = [];
    next.forEach(item => {
      if (blank(item.trigger)) errors.push('Every rule needs a trigger');
      if (!all.taskTypes.some(type => type.id === item.taskTypeId)) errors.push(`${item.trigger}: choose a task type`);
      if (item.assignTo === 'Named role' && blank(item.role)) errors.push(`${item.trigger}: choose a role`);
    });
    return [...new Set(errors)];
  },
  qualificationApproval: next => flowErrors(next, 'Qualification approval', ['Central Approver']),
  capabilityApproval: next => flowErrors(next, 'Capability approval', ['Central Authority', 'Buyer']),
  qsl: next => {
    const errors: string[] = [];
    if (next.ratingScale.some(item => blank(item.label)) || !unique(next.ratingScale.map(item => item.label))) errors.push('Rating level labels must be unique and not empty');
    return errors;
  },
  samples: next => {
    const errors: string[] = [];
    if (!unique(next.requestTypes.map(item => item.name)) || next.requestTypes.some(item => blank(item.name))) errors.push('Request type names must be unique and not empty');
    next.requestTypes.forEach(item => { if (!ints(item.defaultDueDays, 1, 180)) errors.push(`${item.name}: due days must be between 1 and 180`); });
    next.requirements.forEach(item => {
      if (blank(item.name)) errors.push('Requirement names cannot be empty');
      if (!next.requestTypes.some(type => type.id === item.requestTypeId)) errors.push(`${item.name}: choose a request type`);
    });
    if (!unique(next.criteria.map(item => item.name)) || next.criteria.some(item => blank(item.name))) errors.push('Evaluation criteria must be unique and not empty');
    next.criteria.forEach(item => { if (!ints(item.passMark, 0, 100)) errors.push(`${item.name}: pass mark must be between 0 and 100`); });
    if (!unique(next.resultOptions.map(item => item.label)) || next.resultOptions.some(item => blank(item.label))) errors.push('Result options must be unique and not empty');
    if (!next.resultOptions.some(item => item.outcome === 'Accept') || !next.resultOptions.some(item => item.outcome === 'Fail')) errors.push('Result options need at least one Accept and one Fail outcome');
    return [...new Set(errors)];
  },
  risk: next => {
    const errors: string[] = [];
    if (next.categories.some(item => blank(item.name)) || !unique(next.categories.map(item => item.name))) errors.push('Risk category names must be unique and not empty');
    if (next.categories.reduce((total, item) => total + item.weight, 0) !== 100) errors.push('Risk category weights must total 100');
    next.categories.forEach(category => {
      const own = next.criteria.filter(item => item.categoryId === category.id);
      if (own.length && own.reduce((total, item) => total + item.weight, 0) !== 100) errors.push(`${category.name}: criteria weights must total 100`);
    });
    next.criteria.forEach(item => { if (!next.categories.some(category => category.id === item.categoryId) || blank(item.name)) errors.push('Every criterion needs a name and a category'); });
    const mins = next.levels.map(item => item.min);
    if (mins[0] !== 0 || mins.some((value, index) => index > 0 && (value <= mins[index - 1] || value > 100))) errors.push('Risk level thresholds must start at 0 and increase up to 100');
    return [...new Set(errors)];
  },
  triggers: next => {
    const errors: string[] = [];
    next.forEach(item => {
      if (item.enabled && !item.channels.length) errors.push(`${item.event}: choose at least one channel`);
      if (item.enabled && blank(item.recipients)) errors.push(`${item.event}: recipients are required`);
      if (item.reminderDays.some((day, index) => !ints(day, 1, 365) || (index > 0 && day >= item.reminderDays[index - 1]))) errors.push(`${item.event}: reminders must be positive days in descending order`);
    });
    return errors;
  },
  templates: (next, _prev, all) => {
    const errors: string[] = [];
    next.forEach(item => {
      const trigger = all.triggers.find(entry => entry.id === item.triggerId);
      if (!trigger) errors.push('Every template needs a trigger event');
      else if (!trigger.channels.includes(item.channel)) errors.push(`${trigger.event}: the trigger does not use the ${item.channel} channel`);
      if (blank(item.subject) || blank(item.body)) errors.push('Subject and body are required');
    });
    return [...new Set(errors)];
  },
  access: next => {
    const errors: string[] = [];
    ADMIN_ROLES.forEach(role => { if (!next[role]) errors.push(`Role ${role} is missing`); });
    if (!next.Admin?.menus.Administration || !next.Admin?.actions.Configure) errors.push('Admin must keep access to Administration and the Configure action');
    return errors;
  },
};

function flowErrors(next: ConfigState['qualificationApproval'], label: string, required: string[]): string[] {
  const errors: string[] = [];
  if (!next.steps.length) errors.push(`${label}: at least one approval step is required`);
  if (!unique(next.steps.map(item => item.role))) errors.push(`${label}: each role can appear once`);
  if (next.steps.some(item => !REVIEWER_ROLES.includes(item.role))) errors.push(`${label}: unknown approver role`);
  required.forEach(role => { if (!next.steps.some(item => item.role === role && item.required)) errors.push(`${label}: ${role} approval is mandatory`); });
  if (next.mode === 'Parallel' && next.steps.length < 2) errors.push(`${label}: parallel approval needs at least two steps`);
  if (next.delegation.enabled && !ints(next.delegation.maxDays, 1, 90)) errors.push(`${label}: delegation must be between 1 and 90 days`);
  return errors;
}

// Applies a change to one settings section; nothing is stored unless the whole section is valid.
export function updateConfig<K extends ConfigSection>(section: K, recipe: (draft: ConfigState[K]) => void, summary: string): ConfigState[K] {
  const previous = state[section];
  const draft = structuredClone(previous);
  recipe(draft);
  const candidate = { ...state, [section]: draft } as ConfigState;
  const errors = (validators[section] as Validator<K>)(draft, previous, candidate);
  if (errors.length) throw new ConfigError(errors);
  state = candidate;
  changes.push({ at: new Date().toISOString(), section, summary });
  notify();
  return structuredClone(draft);
}

