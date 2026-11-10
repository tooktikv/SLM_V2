import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRevision, subscribe } from './store.ts';
import { ensureDemoData } from './seed.ts';

ensureDemoData();

export type QueryState<T> = { data: T | undefined; loading: boolean; error: string | null };

// Runs a QSL query and re-runs it when its inputs or the underlying QSL data change.
export function useQslQuery<T>(load: () => T, deps: readonly unknown[]): QueryState<T> {
  const revision = useSyncExternalStore(subscribe, getRevision);
  const [state, setState] = useState<QueryState<T>>({ data: undefined, loading: true, error: null });
  useEffect(() => {
    let current = true;
    Promise.resolve().then(load).then(
      data => { if (current) setState({ data, loading: false, error: null }); },
      error => { if (current) setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Unexpected error' })); },
    );
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);
  return state;
}
