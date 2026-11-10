import { useSyncExternalStore } from 'react';
import { ensureIntegrationDemo } from '../integration/service.ts';
import { ensureTaskDemo, getRevision, subscribe } from './service.ts';

ensureIntegrationDemo();
ensureTaskDemo();

// Re-renders the caller whenever task data changes; read data inside render.
export const useTasksRevision = (): number => useSyncExternalStore(subscribe, getRevision);
