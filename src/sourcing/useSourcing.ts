import { useSyncExternalStore } from 'react';
import { ensureSourcingDemo, getRevision, subscribe } from './service.ts';

ensureSourcingDemo();

// Re-renders the caller whenever sourcing data changes; read data inside render.
export const useSourcingRevision = (): number => useSyncExternalStore(subscribe, getRevision);
