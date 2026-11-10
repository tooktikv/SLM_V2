export type ListItem = { id: string; name: string; active: boolean; locked?: boolean };
export type ListKey = 'businessUnits' | 'supplierTypes' | 'productCategories' | 'industryCategories' | 'regions' | 'certificateTypes' | 'supplierStatuses';

export type GeneralSettings = { organization: string; legalEntity: string; language: 'English' | 'Thai'; dateFormat: 'DD MMM YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'; timeZone: string; currency: string };

// Each task type owns its review workflow; they are never forced to share one.
export type ReviewWorkflow = 'Single reviewer' | 'Two-step review' | 'Auto-accept';
export type TaskType = { id: string; name: string; reviewWorkflow: ReviewWorkflow; reviewerRole: string; secondReviewerRole?: string; dueDays: number; reminderDaysBefore: number; allowReturn: boolean; active: boolean };
export type TaskTemplate = { id: string; name: string; taskTypeId: string; instructions: string; requiredForms: string; requiredDocuments: string; active: boolean };
export type AssignmentRule = { id: string; trigger: string; taskTypeId: string; assignTo: 'Supplier owner' | 'Category owner' | 'Named role'; role?: string; active: boolean };

type ApprovalStep = { id: string; role: string; required: boolean };
export type ApprovalFlow = {
  mode: 'Sequential' | 'Parallel';
  steps: ApprovalStep[];
  delegation: { enabled: boolean; maxDays: number };
  assignments: { scope: string; approver: string }[];
};

type RatingLevel = { level: 1 | 2 | 3; label: string; description: string };
export type QslRules = {
  ratingScale: RatingLevel[];
  pendingCapabilityInvalidatesApproved: boolean;
  autoPublish: boolean;
  publishToPortal: boolean;
  requirePublisherConfirmation: boolean;
};

export type SampleRequestType = { id: string; name: string; defaultDueDays: number; evaluationRequired: boolean; active: boolean };
export type SampleRequirement = { id: string; requestTypeId: string; name: string; mandatory: boolean };
export type SampleCriterion = { id: string; name: string; passMark: number; active: boolean };
export type SampleResultOption = { id: string; label: string; outcome: 'Accept' | 'Fail' | 'Retest' };
export type SampleSettings = { requestTypes: SampleRequestType[]; requirements: SampleRequirement[]; criteria: SampleCriterion[]; resultOptions: SampleResultOption[] };

export type RiskCategory = { id: string; name: string; weight: number };
export type RiskCriterion = { id: string; categoryId: string; name: string; weight: number; questionnaire: boolean };
export type RiskLevel = { name: 'Low' | 'Medium' | 'High' | 'Critical'; min: number };
export type RiskSettings = { categories: RiskCategory[]; criteria: RiskCriterion[]; scoring: { method: 'Weighted average'; scale: 100 }; levels: RiskLevel[] };

export type NotificationChannel = 'In-app' | 'Email';
export type NotificationTrigger = { id: string; event: string; enabled: boolean; channels: NotificationChannel[]; recipients: string; reminderDays: number[] };
export type NotificationTemplate = { id: string; triggerId: string; channel: NotificationChannel; subject: string; body: string };

export const MENUS = ['Dashboard', 'Onboarding', 'Supplier Management', 'Qualification & Capability', 'QSL', 'Risk', 'Compliance', 'Performance', 'Relationship', 'Audit', 'CAR & CAP', 'Reports', 'Administration'] as const;
export const ACTIONS = ['Create', 'Edit', 'Review', 'Approve', 'Publish', 'Export', 'Delete', 'Configure'] as const;
export type RoleAccess = { menus: Record<string, boolean>; actions: Record<string, boolean>; scope: 'All business units' | 'Own business unit' | 'Assigned suppliers' };
export type AccessSettings = Record<string, RoleAccess>;

export type ConfigState = {
  general: GeneralSettings;
  lists: Record<ListKey, ListItem[]>;
  taskTypes: TaskType[];
  taskTemplates: TaskTemplate[];
  assignmentRules: AssignmentRule[];
  qualificationApproval: ApprovalFlow;
  capabilityApproval: ApprovalFlow;
  qsl: QslRules;
  samples: SampleSettings;
  risk: RiskSettings;
  triggers: NotificationTrigger[];
  templates: NotificationTemplate[];
  access: AccessSettings;
};

export type ConfigSection = keyof ConfigState;
export type ConfigChange = { at: string; section: ConfigSection; summary: string };
