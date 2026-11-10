import type { Actor, EntityVersion, Versioned } from './types.ts';
import { audit, clone, nowIso } from './store.ts';
import { fail } from './errors.ts';

export const latestVersion = <T>(entity: Versioned<T>): EntityVersion<T> => entity.versions[entity.versions.length - 1];
export const publishedVersion = <T>(entity: Versioned<T>): EntityVersion<T> | undefined => [...entity.versions].reverse().find(v => v.status === 'Published');
export const getVersion = <T>(entity: Versioned<T>, version: number): EntityVersion<T> | undefined => entity.versions.find(v => v.version === version);

export function findOrFail<E extends { id: string }>(list: E[], id: string, label: string): E {
  return list.find(item => item.id === id) ?? fail('NOT_FOUND', `${label} ${id} was not found`);
}

export function newVersioned<T>(id: string, data: T, actor: Actor): Versioned<T> {
  return { id, active: true, versions: [{ version: 1, status: 'Draft', data: clone(data), createdAt: nowIso(), createdBy: actor.id }] };
}

// Edits go to the open draft; if the latest version is already published, a new draft version is opened.
export function saveDraft<T>(entity: Versioned<T>, data: T, actor: Actor): EntityVersion<T> {
  const latest = latestVersion(entity);
  if (latest.status === 'Draft') {
    latest.data = clone(data);
    return latest;
  }
  const draft: EntityVersion<T> = { version: latest.version + 1, status: 'Draft', data: clone(data), createdAt: nowIso(), createdBy: actor.id };
  entity.versions.push(draft);
  return draft;
}

export function publishLatest<T>(entity: Versioned<T>, actor: Actor): EntityVersion<T> {
  const latest = latestVersion(entity);
  if (latest.status !== 'Draft') fail('INVALID_TRANSITION', `Version ${latest.version} is already published; create a new draft first`);
  entity.versions.forEach(v => { if (v.status === 'Published') v.status = 'Superseded'; });
  latest.status = 'Published';
  latest.publishedAt = nowIso();
  latest.publishedBy = actor.id;
  return latest;
}

export function auditVersioned<T>(actor: Actor, action: string, recordType: string, entity: Versioned<T>, previous: unknown, remarks?: string): void {
  audit(actor, { action, recordType, recordRef: entity.id, previous, next: entity, remarks });
}
