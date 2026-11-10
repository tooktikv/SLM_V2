import { useSyncExternalStore } from 'react';
import { ensureIntegrationDemo } from './service.ts';
import { getRevision, subscribe } from './store.ts';

ensureIntegrationDemo();

// Re-renders the caller whenever integration data changes; read data inside render.
export function useIntegrationRevision(): number {
  return useSyncExternalStore(subscribe, getRevision);
}
