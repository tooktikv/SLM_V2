import { useState, type ReactNode } from 'react';
import type { Actor } from '../../qsl/types';
import { SegmentedControl } from '../../components/ui';
import { CapabilityTab } from './CapabilityTab';
import { HistoryTab } from './History';

type View = 'qualified' | 'history';

// Supplier Qualified List: approved suppliers with their capability, plus the qualification history. Suppliers only see their own history.
export function QualifiedTab({ actor, onOpen, onProfile, onAssignTask, actions }: { actor: Actor; onOpen: (id: string) => void; onProfile: (supplierId: string, tab?: string) => void; onAssignTask?: (supplierId: string) => void; actions?: ReactNode }) {
  const [view, setView] = useState<View>('qualified');
  if (actor.role === 'Supplier') return <HistoryTab actor={actor} onOpen={onOpen} />;

  return (
    <div className="space-y-4">
      <SegmentedControl<View> label="Qualified list view" value={view} onChange={setView} items={[{ value: 'qualified', label: 'Qualified & capability' }, { value: 'history', label: 'History' }]} />
      {view === 'qualified' ? <CapabilityTab actor={actor} onOpen={onOpen} onProfile={onProfile} onAssignTask={onAssignTask} actions={actions} /> : <HistoryTab actor={actor} onOpen={onOpen} />}
    </div>
  );
}
