import { useState } from 'react';
import { LIST_LABELS, getConfig, updateConfig } from '../../config';
import type { ListKey } from '../../config';
import { SegmentedControl } from '../../components/ui';
import { ListEditor, NoticeBox, useAction, useConfigRevision } from './shared';

const KEYS: ListKey[] = ['supplierTypes', 'productCategories', 'industryCategories', 'regions', 'certificateTypes', 'supplierStatuses'];

// B. Master data lists that other modules pick from. Supplier category and document type keep their existing sections.
export default function MasterDataSettings() {
  useConfigRevision();
  const { notice, run, clear } = useAction();
  const [key, setKey] = useState<ListKey>('supplierTypes');
  const [drafts, setDrafts] = useState(() => getConfig('lists'));

  return (
    <div className="max-w-3xl space-y-4">
      <SegmentedControl<ListKey> label="Master data list" value={key} onChange={next => { setKey(next); clear(); }} items={KEYS.map(item => ({ value: item, label: LIST_LABELS[item] }))} />
      <NoticeBox notice={notice} />
      <ListEditor key={key} title={LIST_LABELS[key]} description={key === 'supplierStatuses' ? 'Existing status values are system values and are mapped to the shared statuses, never replaced' : 'Inactive values stay on existing records but cannot be chosen for new ones'}
        items={drafts[key]} onChange={items => setDrafts(current => ({ ...current, [key]: items }))}
        onSave={() => run(() => { updateConfig('lists', draft => { draft[key] = drafts[key]; }, `${LIST_LABELS[key]} updated`); }, `${LIST_LABELS[key]} saved`)} />
    </div>
  );
}
