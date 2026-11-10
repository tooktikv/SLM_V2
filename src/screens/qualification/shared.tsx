import type { ProcessStatus, QslResult } from '../../qsl/types';
import type { Standing, Validity } from '../../qsl/services/queries';
import type { CapabilityStatus, EligibilityState } from '../../qsl/services/qslRegister';
import { resultLabel, validityLabel } from '../../qsl/labels';
import { QslError } from '../../qsl/errors';
import { Badge, Callout, type Tone } from '../../components/ui';
import { getLang } from '../../i18n';

// Dates show as day, short month, year (UTC); Thai uses the Buddhist-era year.
export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString(getLang() === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const statusTone: Record<ProcessStatus, Tone> = {
  Draft: 'neutral', WaitingSupplier: 'warning', PreQualReview: 'info', SampleEvaluation: 'info', WaitingAssessment: 'info', InfoRequested: 'warning',
  WaitingVerification: 'brand', WaitingApproval: 'brand', Completed: 'success',
};

const resultTone: Record<QslResult, Tone> = { None: 'neutral', Pass: 'success', Fail: 'danger' };
const validityTone: Record<Validity, Tone> = { Valid: 'success', Expiring: 'warning', Expired: 'danger', Unspecified: 'neutral' };
const standingTone: Record<Standing, Tone> = { Published: 'success', Expiring: 'warning', Expired: 'danger', Suspended: 'neutral', Withdrawn: 'neutral' };

export const ResultBadge = ({ result }: { result: QslResult }) => <Badge tone={resultTone[result]} small dot>{resultLabel[result]}</Badge>;
export const ValidityBadge = ({ validity }: { validity?: Validity }) => (validity ? <Badge tone={validityTone[validity]} small dot>{validityLabel[validity]}</Badge> : <span className="text-ink-muted">—</span>);
export const StandingBadge = ({ standing }: { standing?: Standing }) => (standing ? <Badge tone={standingTone[standing]} small dot>{standing}</Badge> : <span className="text-ink-muted">—</span>);

const levelTone: Record<number, Tone> = { 1: 'warning', 2: 'success', 3: 'brand' };
export const LevelBadge = ({ level }: { level?: number }) => (level ? <Badge tone={levelTone[level]} small>Level {level}</Badge> : <span className="text-ink-muted">—</span>);

const capabilityTone: Record<CapabilityStatus, Tone> = {
  Approved: 'success', Expired: 'danger', Rejected: 'danger', 'Revision requested': 'warning', 'Pending central verification': 'brand', 'Pending buyer approval': 'brand', 'In assessment': 'info',
};
export const CapabilityBadge = ({ status }: { status: CapabilityStatus }) => <Badge tone={capabilityTone[status]} small dot>{status}</Badge>;

const eligibilityTone: Record<EligibilityState, Tone> = { Eligible: 'success', NotEligible: 'danger', Published: 'brand' };
const eligibilityText: Record<EligibilityState, string> = { Eligible: 'Eligible', NotEligible: 'Not eligible', Published: 'Published' };
export const EligibilityBadge = ({ state }: { state: EligibilityState }) => <Badge tone={eligibilityTone[state]} small dot>{eligibilityText[state]}</Badge>;

export function errorMessage(error: unknown): { message: string; details: string[] } {
  if (error instanceof QslError) return { message: error.message, details: error.details };
  return { message: error instanceof Error ? error.message : 'Something went wrong', details: [] };
}

export type Notice = { tone: 'danger' | 'success'; text: string; details?: string[] };

export function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return <Callout tone={notice.tone} title={notice.text}>{notice.details && notice.details.length > 0 && <ul className="list-disc pl-4">{notice.details.map(line => <li key={line}>{line}</li>)}</ul>}</Callout>;
}

// Runs a service call and turns a thrown QslError into a notice.
export function attempt(action: () => void, setNotice: (notice: Notice | null) => void, success?: string): boolean {
  try {
    action();
    setNotice(success ? { tone: 'success', text: success } : null);
    return true;
  } catch (error) {
    const { message, details } = errorMessage(error);
    setNotice({ tone: 'danger', text: message, details });
    return false;
  }
}

