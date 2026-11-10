import type { ProcessStatus, QslResult, Verdict } from './types.ts';

export const statusLabel: Record<ProcessStatus, string> = {
  Draft: 'Draft', WaitingSupplier: 'Waiting for supplier', PreQualReview: 'Pre-qualification review', SampleEvaluation: 'Sample evaluation',
  WaitingAssessment: 'Waiting for assessment', InfoRequested: 'Info requested', WaitingApproval: 'Waiting for approval', Completed: 'Completed',
};

// What the supplier sees instead of the internal process status.
export const supplierStatusLabel: Record<ProcessStatus, string> = {
  Draft: 'Request being prepared', WaitingSupplier: 'Action needed: submit information', PreQualReview: 'Under review', SampleEvaluation: 'Sample under evaluation', WaitingAssessment: 'Assessment in progress',
  InfoRequested: 'Action needed: update information', WaitingApproval: 'Decision pending', Completed: 'Completed',
};

export const resultLabel: Record<QslResult, string> = { None: 'No result', Pass: 'Passed', Fail: 'Failed' };
export const verdictLabel: Record<Verdict, string> = { Compliant: 'Compliant', NonCompliant: 'Non-compliant', NeedsFix: 'Needs fix' };
export const validityLabel = { Valid: 'Valid', Expiring: 'Expiring', Expired: 'Expired', Unspecified: 'Unspecified' } as const;
export const typeLabel = { First: 'First assessment', Re: 'Reassessment' } as const;
