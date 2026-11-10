import { useSyncExternalStore } from 'react';
import { ensureIntegrationDemo } from '../integration/service.ts';
import { getRevision, subscribe } from './service.ts';

ensureIntegrationDemo();

// Re-renders the caller whenever a sample request changes; read data inside render.
export const useSamplesRevision = (): number => useSyncExternalStore(subscribe, getRevision);
