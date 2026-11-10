import { useState, type ReactNode } from 'react';
import { Button, Field, Modal, Textarea } from '../../components/ui';
import { NoticeBox, attempt, type Notice } from './shared';

// Small confirmation dialog with a reason field and optional extra inputs.
export function ReasonModal({ title, eyebrow, label = 'Reason', extra, confirmLabel, danger, onClose, onSubmit }: {
  title: string;
  eyebrow?: string;
  label?: string | null;
  extra?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const submit = () => { if (attempt(() => onSubmit(reason), setNotice)) onClose(); };
  return (
    <Modal title={title} eyebrow={eyebrow} onClose={onClose} closeLabel="Close">
      <div className="space-y-4">
        <NoticeBox notice={notice} />
        {extra}
        {label !== null && <Field label={label} required><Textarea value={reason} onChange={event => setReason(event.target.value)} /></Field>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
