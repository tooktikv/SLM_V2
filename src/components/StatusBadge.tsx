import { Badge } from './ui/Badge';
import type { Tone } from './ui/tones';

const toneMap: Record<string, Tone> = {
  Active: 'success',
  Approved: 'success',
  Qualified: 'success',
  Pass: 'success',
  Completed: 'success',
  Closed: 'success',
  Connected: 'success',
  'Low Risk': 'success',
  Pending: 'warning',
  Conditional: 'warning',
  Suspended: 'warning',
  'Medium Risk': 'warning',
  'In Progress': 'info',
  Open: 'info',
  Rejected: 'danger',
  Expired: 'danger',
  Overdue: 'danger',
  'High Risk': 'danger',
  Critical: 'danger',
  Fail: 'danger',
  Error: 'danger',
  Draft: 'neutral',
  Disconnected: 'neutral',
  'No data received': 'neutral',
};

export default function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return (
    <Badge tone={toneMap[status] ?? 'neutral'} small={small} dot>
      {status}
    </Badge>
  );
}
