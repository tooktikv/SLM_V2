import type { PortalRequest, ProcessStatus, Qsl, RateBasis, RequiredEvidence } from '../types.ts';

// Values the Supplier Portal accepts; they must match its field spec exactly.
export const RATE_BASES: RateBasis[] = ['Hourly', 'Daily', 'Monthly'];
export const CURRENCIES = ['THB', 'USD', 'EUR', 'JPY', 'CNY'];
export const EVIDENCE_DOC_TYPES = ['Company Registration', 'Tax Documentation', 'Identity Document', 'Site Photos', 'Quality Certification', 'Factory Documentation', 'Insurance Certificate', 'Supplier Declaration', 'Product Evidence', 'Questionnaire Evidence', 'Other'];
export const MAX_RATE = 10_000_000;

export type PortalStatus = 'Requested' | 'Draft' | 'Submitted' | 'Under Review' | 'Additional Information Required' | 'Assessment In Progress' | 'Pending Qualification Approval' | 'Result Released' | 'Withdrawn';

// The status the Supplier Portal shows for a round. A draft has not been sent yet.
export function portalStatusOf(qsl: Qsl): PortalStatus | null {
  const map: Record<ProcessStatus, PortalStatus | null> = {
    Draft: null, WaitingSupplier: 'Requested', PreQualReview: qsl.preReview ? 'Under Review' : 'Submitted', SampleEvaluation: 'Under Review', WaitingAssessment: 'Assessment In Progress',
    InfoRequested: 'Additional Information Required', WaitingApproval: 'Pending Qualification Approval', Completed: 'Result Released',
  };
  return map[qsl.status];
}

const defaultRequiredEvidence = (): RequiredEvidence[] => [
  { id: 'req-iso', title: 'Quality management certificate (ISO 9001 or equivalent)', description: 'Current certificate covering the site that will serve this Buyer.', docTypes: ['Quality Certification'], mandatory: true },
  { id: 'req-org', title: 'Workforce list or organisation chart', description: 'Shows the headcount declared in the rate card.', docTypes: ['Factory Documentation', 'Other'], mandatory: false },
];

export const defaultPortalRequest = (buyer = ''): PortalRequest => ({
  requestId: '', buyer, instructions: 'Complete the rate card for every skill we list. Quote your standard rates before any negotiated discount.',
  currencies: ['THB', 'USD'], rateBases: ['Hourly', 'Daily', 'Monthly'], requiredEvidence: defaultRequiredEvidence(),
});

export function validatePortalRequest(portal: PortalRequest): string[] {
  const errors: string[] = [];
  if (!portal.buyer.trim()) errors.push('Please enter the requesting buyer');
  if (!portal.instructions.trim()) errors.push('Please enter the submission instructions for the supplier');
  if (!portal.currencies.length) errors.push('Please select at least one currency');
  else if (portal.currencies.some(code => !/^[A-Z]{3}$/.test(code))) errors.push('Currencies must be 3-letter codes, e.g. THB');
  if (!portal.rateBases.length) errors.push('Please select at least one rate basis');
  else if (portal.rateBases.some(item => !RATE_BASES.includes(item))) errors.push('Rate basis must be Hourly, Daily or Monthly');
  if (portal.requiredEvidence.some(item => !item.title.trim())) errors.push('Every required document needs a title');
  if (portal.requiredEvidence.some(item => item.docTypes.some(type => !EVIDENCE_DOC_TYPES.includes(type)))) errors.push('Unknown document type in the required documents');
  if (new Set(portal.requiredEvidence.map(item => item.id)).size !== portal.requiredEvidence.length) errors.push('Required document IDs must be unique');
  return errors;
}

// "QSL-2569-0004" -> "QR-2569-0004", the request reference the Supplier Portal uses as its key.
export const portalRequestId = (qslNo: string) => `QR-${qslNo.replace(/^QSL-/, '')}`;
