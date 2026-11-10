// QSL domain model. Supplier, document and organisation data stay in src/data and are referenced by id.

export type Role = 'Supplier' | 'Coordinator' | 'Assessor' | 'Approver' | 'Buyer' | 'Admin';
export type Actor = { id: string; name: string; role: Role; supplierIds?: string[] };
export type QslUser = { id: string; name: string; role: 'Coordinator' | 'Assessor' | 'Approver' };

type VersionStatus = 'Draft' | 'Published' | 'Superseded';
export type EntityVersion<T> = { version: number; status: VersionStatus; data: T; createdAt: string; createdBy: string; publishedAt?: string; publishedBy?: string };
export type Versioned<T> = { id: string; active: boolean; versions: EntityVersion<T>[] };

// Criteria: Standard criteria belong to the central authority; Buyer custom criteria stay separate and buyer-owned.
export type AnswerType = 'ShortText' | 'LongText' | 'Choice' | 'Number' | 'Date' | 'File';
export type CriteriaKind = 'Standard' | 'BuyerCustom';
export type CriteriaGroup = { id: string; name: string; active: boolean }; // a group is a Skill
export type CriteriaData = {
  code: string;
  name: string;
  groupId: string;
  description: string;
  answerType: AnswerType;
  options?: string[];
  unit?: string;
  evidenceRequired: boolean;
  levels: [string, string, string];
};
export type Criteria = Versioned<CriteriaData> & { kind: CriteriaKind };
export type FormItem = { criteriaId: string; criteriaVersion: number; required: boolean };
export type FormData = { code: string; name: string; categories: string[]; sections: { title: string; items: FormItem[] }[]; validityMonths?: number };
export type AssessmentForm = Versioned<FormData>;

type DecisionMethod = 'PassFail' | 'Score' | 'Level';
export type ProcessSettings = {
  coordinatorIds: string[];
  assessorIds: string[];
  approverIds: string[];
  separateAssessorApprover: boolean;
  decisionMethod: DecisionMethod;
  useSkillLevel: boolean;
  validityMonthsByCategory: Record<string, number>;
  reminderDays: number;
  reassessmentTriggers: Record<string, boolean>;
};
export type SettingsChange = { at: string; by: string; summary: string };

// Process (workflow) status. The qualification outcome is tracked separately in result / enrollment.
export type ProcessStatus =
  | 'Draft' | 'WaitingSupplier' | 'PreQualReview' | 'SampleEvaluation' | 'WaitingAssessment' | 'InfoRequested' | 'WaitingApproval' | 'Completed';
export type QslResult = 'None' | 'Pass' | 'Fail';
export type Verdict = 'Compliant' | 'NonCompliant' | 'NeedsFix';
export type AnswerValue = string | number;
export type Level = 1 | 2 | 3;

type Answer = { criteriaId: string; value: AnswerValue; updatedAt: string };
type Evidence = { id: string; criteriaId: string; fileName: string; addedAt: string; addedBy: string };
type Correction = { criteriaId: string; message: string; requestedAt: string; resolvedAt?: string };
export type Evaluation = { criteriaId: string; verdict: Verdict; comment: string; requestCorrection: boolean; messageToSupplier: string; evaluatedBy: string; evaluatedAt: string };
type SubmissionRound = { round: number; submittedAt: string; submittedBy: string; answers: Answer[]; evidenceIds: string[]; note: string };

// Skill ratings are stored in two separate places: the supplier's self-rating and the assessor's rating, which is the final one.
export type SkillRating = { skillId: string; level: Level; comment?: string };
export type CertifiedSkillView = { skillId: string; name: string; level: Level };

type PreReview = { infoChecked: boolean; documentsChecked: boolean; decision: 'Proceed' | 'RequestInfo' | 'Reject'; comment: string; by: string; byName: string; at: string };
type SampleEvaluationRecord = { reference: string; result: 'Pass' | 'Fail'; comment: string; by: string; byName: string; at: string };
type InfoRequest = { message: string; from: 'PreQualReview'; requestedAt: string; resolvedAt?: string };

type ApprovalEntry = { id: string; decision: 'Approve' | 'Reject' | 'Return'; reason: string; by: string; byName: string; at: string };
type Decision = { result: 'Pass' | 'Fail'; reason: string; effectiveDate: string; expiryDate?: string; by: string; byName: string; at: string };

// Supplier Portal exchange: what SLM asks for (request) and what the supplier sends back (rate card). Field names follow the SLM-Portal field spec.
export type RateBasis = 'Hourly' | 'Daily' | 'Monthly';
export type PortalRole = 'Supplier Admin' | 'Supplier User' | 'Supplier Viewer';
export type RequiredEvidence = { id: string; title: string; description: string; docTypes: string[]; mandatory: boolean };
export type PortalRequest = { requestId: string; buyer: string; instructions: string; currencies: string[]; rateBases: RateBasis[]; requiredEvidence: RequiredEvidence[] };
export type CommercialTerms = { currency: string; rateBasis: RateBasis; effectiveFrom: string; validUntil: string; leadTimeDays?: number; paymentTermsDays?: number; escalationPct?: number; overtimeWeekday?: number; overtimeHoliday?: number; notes: string };
export type RateLine = { level: Level; headcount: number; avgYears: number; rate: number };
export type SkillOffer = { criteriaId: string; offered: boolean; selfRating?: Level; comment: string; lines: RateLine[] };
export type EvidenceLink = { id: string; targetId: string; docId: string; docName: string; docType: string; version: number; issue?: string; expiry?: string; fileNames: string[]; note: string };
export type RateCardSubmission = {
  ref: string; version: number; kind: 'Initial' | 'Revision'; revisesVersion?: number; infoRequestId?: string; submittedAt: string; submittedBy: string; role: PortalRole;
  terms: CommercialTerms; skills: SkillOffer[]; evidence: EvidenceLink[]; replies: Record<string, string>; declaration: boolean;
};

// Naming note: `Qsl` is one qualification round (assessment record); the Qualified Supplier List entry is its `enrollment` (published listing).
export type ScopeType = 'Site / plant' | 'Product line' | 'Service delivery' | 'Company-wide';
export const SCOPE_TYPES: ScopeType[] = ['Site / plant', 'Product line', 'Service delivery', 'Company-wide'];
type Enrollment = {
  listingNo: string;
  productCategory: string;
  scopeType: ScopeType;
  scopeDetail: string;
  level?: Level;
  enrolledAt: string;
  publishedBy: string;
  effectiveDate: string;
  expiryDate?: string;
  scopeHistory: { at: string; by: string; scopeType: ScopeType; scopeDetail: string }[];
  withdrawal?: { reason: string; by: string; at: string };
};
type Suspension = { reason: string; suspendedBy: string; suspendedAt: string; reactivatedBy?: string; reactivatedAt?: string; reactivationNote?: string };
type Extension = { previousExpiry: string; newExpiry: string; reason: string; by: string; at: string };

export type Qsl = {
  id: string;
  qslNo: string;
  supplierId: string;
  category: string;
  formId: string;
  assessmentType: 'First' | 'Re';
  previousQslId?: string;
  round: number;
  status: ProcessStatus;
  result: QslResult;
  sampleRequired: boolean;
  scopeType: ScopeType;
  scopeDetail: string;
  coordinatorId: string;
  assessorId: string;
  approverId: string;
  dueDate?: string;
  reason: string;
  documents: string[];
  createdAt: string;
  createdBy: string;
  submittedAt?: string;
  snapshotId?: string;
  answers: Answer[];
  evidence: Evidence[];
  portal: PortalRequest;
  rateCards: RateCardSubmission[];
  corrections: Correction[];
  infoRequest?: InfoRequest;
  infoReturnTo?: ProcessStatus;
  submissions: SubmissionRound[];
  preReview?: PreReview;
  sample?: SampleEvaluationRecord;
  evaluations: Evaluation[];
  selfRatings: SkillRating[];
  assessedRatings: SkillRating[];
  recommended?: 'Pass' | 'Fail';
  evaluationSummary: string;
  internalNote: string;
  assessedBy?: string;
  assessedAt?: string;
  approvals: ApprovalEntry[];
  decision?: Decision;
  enrollment?: Enrollment;
  suspensions: Suspension[];
  extensions: Extension[];
};

// Immutable copy of the form and criteria a round is assessed against.
export type Snapshot = {
  id: string;
  qslId: string;
  createdAt: string;
  supplier: { id: string; name: string; country: string; taxId?: string };
  form: { id: string; version: number; data: FormData };
  criteria: { id: string; kind: CriteriaKind; version: number; data: CriteriaData; groupName: string }[];
  skills: { id: string; name: string }[];
  useSkillLevel: boolean;
};

export type HistoryKind = 'status' | 'approval' | 'event';
export type HistoryEntry = { id: string; at: string; by: string; byName: string; role: Role; qslId: string; kind: HistoryKind; action: string; note?: string; internal: boolean };
export type AuditEntry = { id: string; action: string; recordType: string; recordRef: string; previousValue: unknown; newValue: unknown; performedBy: string; performedByRole: Role; performedAt: string; remarks?: string };
