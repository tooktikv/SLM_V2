import { useState } from 'react';
import type { Actor, ScopeType } from '../../qsl/types';
import { SCOPE_TYPES } from '../../qsl/types';
import { assignScope, extendValidity } from '../../qsl/services/assessments';
import type { DirectoryRow } from '../../qsl/services/queries';
import { Field, Input, Select } from '../../components/ui';
import { ReasonModal } from '../qualification/ReasonModal';
import { formatDate } from '../qualification/shared';

export function ScopeModal({ actor, row, onClose }: { actor: Actor; row: DirectoryRow; onClose: () => void }) {
  const [scopeType, setScopeType] = useState<ScopeType>(row.scopeType as ScopeType);
  const [detail, setDetail] = useState(row.scopeDetail);
  return (
    <ReasonModal title="Set QSL scope" eyebrow={`${row.supplierName} · ${row.category}`} label={null} confirmLabel="Save scope" onClose={onClose}
      onSubmit={() => assignScope(actor, row.id, { scopeType, scopeDetail: scopeType === 'Company-wide' ? '' : detail })}
      extra={<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Scope"><Select value={scopeType} onChange={event => setScopeType(event.target.value as ScopeType)}>{SCOPE_TYPES.map(item => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="Details"><Input value={detail} disabled={scopeType === 'Company-wide'} onChange={event => setDetail(event.target.value)} /></Field>
      </div>} />
  );
}

export function ExtendModal({ actor, row, onClose }: { actor: Actor; row: DirectoryRow; onClose: () => void }) {
  const [newExpiry, setNewExpiry] = useState('');
  return (
    <ReasonModal title="Renew QSL validity" eyebrow={`${row.supplierName} · ${row.category}`} label="Reason for renewal" confirmLabel="Extend validity" onClose={onClose}
      onSubmit={reason => extendValidity(actor, row.id, { newExpiry, reason })}
      extra={<Field label={`New expiry date (current ${formatDate(row.expiryDate)})`} required><Input type="date" value={newExpiry} min={row.expiryDate} onChange={event => setNewExpiry(event.target.value)} /></Field>} />
  );
}
