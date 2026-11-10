import { Badge, type Tone } from '../../components/ui';
import type { SourcingActivity, SourcingStage } from '../../sourcing';

const stageTone: Record<SourcingStage, Tone> = { Interested: 'info', Shortlisted: 'brand', 'Under Review': 'warning', Selected: 'success', 'Not Selected': 'danger' };

export const stageHint: Record<SourcingStage, string> = {
  Interested: 'Marked as interested by the team',
  Shortlisted: 'Passed the preliminary selection',
  'Under Review': 'Being checked and assessed',
  Selected: 'Chosen supplier',
  'Not Selected': 'Reviewed but not chosen',
};

export const StageBadge = ({ stage, small }: { stage: SourcingStage; small?: boolean }) => <Badge tone={stageTone[stage]} small={small} dot>{stage}</Badge>;

export const formatStamp = (iso: string) => {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function activityLabel(activity: SourcingActivity): string {
  if (activity.action === 'Stage changed') return `${activity.from} \u2192 ${activity.to}`;
  if (activity.action === 'Assigned') return `Assigned to ${activity.assignee}`;
  if (activity.action === 'Removed from sourcing') return `Removed from sourcing (was ${activity.from})`;
  return activity.assignee ? `Marked as interested, assigned to ${activity.assignee}` : 'Marked as interested';
}
