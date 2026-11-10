import { ACTIONS, MENUS } from './types.ts';
import type {
  AccessSettings, ApprovalFlow, ConfigState, ListItem, ListKey, NotificationTemplate, NotificationTrigger, RiskSettings, SampleSettings,
} from './types.ts';

export const ADMIN_ROLES = ['Admin', 'Procurement Manager', 'Supplier Manager', 'Quality Analyst', 'Risk Manager', 'ESG Manager', 'Read Only'];
export const REVIEWER_ROLES = ['Buyer', 'Central Authority', 'Central Approver', 'Procurement Manager', 'Supplier Manager', 'Quality Analyst', 'Risk Manager', 'ESG Manager'];

const items = (names: string[], locked = false): ListItem[] => names.map((name, index) => ({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`, name, active: true, locked: locked || undefined }));

const flow = (mode: ApprovalFlow['mode'], roles: string[]): ApprovalFlow => ({
  mode, steps: roles.map((role, index) => ({ id: `step-${index + 1}`, role, required: true })), delegation: { enabled: true, maxDays: 14 }, assignments: [],
});

const samples = (): SampleSettings => ({
  requestTypes: [
    { id: 'st-approval', name: 'Product approval', defaultDueDays: 14, evaluationRequired: true, active: true },
    { id: 'st-testing', name: 'Lab testing', defaultDueDays: 21, evaluationRequired: true, active: true },
    { id: 'st-cost', name: 'Cost comparison', defaultDueDays: 10, evaluationRequired: false, active: true },
  ],
  requirements: [
    { id: 'sr-1', requestTypeId: 'st-approval', name: 'Production-representative sample', mandatory: true },
    { id: 'sr-2', requestTypeId: 'st-approval', name: 'Certificate of analysis', mandatory: true },
    { id: 'sr-3', requestTypeId: 'st-testing', name: 'Batch number and manufacturing date', mandatory: true },
  ],
  criteria: [
    { id: 'sc-1', name: 'Specification conformity', passMark: 80, active: true },
    { id: 'sc-2', name: 'Appearance and packaging', passMark: 70, active: true },
    { id: 'sc-3', name: 'Lab test result', passMark: 85, active: true },
  ],
  resultOptions: [
    { id: 'sro-1', label: 'Accepted', outcome: 'Accept' },
    { id: 'sro-2', label: 'Failed', outcome: 'Fail' },
    { id: 'sro-3', label: 'Retest required', outcome: 'Retest' },
  ],
});

const risk = (): RiskSettings => ({
  categories: [
    { id: 'rc-fin', name: 'Financial', weight: 25 }, { id: 'rc-ops', name: 'Operational', weight: 25 }, { id: 'rc-esg', name: 'ESG', weight: 20 },
    { id: 'rc-cyber', name: 'Cyber', weight: 15 }, { id: 'rc-geo', name: 'Geopolitical', weight: 15 },
  ],
  criteria: [
    { id: 'rk-1', categoryId: 'rc-fin', name: 'Debt-to-equity ratio', weight: 60, questionnaire: false },
    { id: 'rk-2', categoryId: 'rc-fin', name: 'Audited statements submitted', weight: 40, questionnaire: true },
    { id: 'rk-3', categoryId: 'rc-ops', name: 'Single-site dependency', weight: 50, questionnaire: true },
    { id: 'rk-4', categoryId: 'rc-ops', name: 'Business continuity plan', weight: 50, questionnaire: true },
  ],
  scoring: { method: 'Weighted average', scale: 100 },
  levels: [{ name: 'Low', min: 0 }, { name: 'Medium', min: 40 }, { name: 'High', min: 70 }, { name: 'Critical', min: 85 }],
});

const triggers = (): NotificationTrigger[] => [
  { id: 'tg-doc', event: 'Document expiry', enabled: true, channels: ['In-app', 'Email'], recipients: 'Supplier owner, Supplier', reminderDays: [90, 60, 30] },
  { id: 'tg-task', event: 'Task assigned or overdue', enabled: true, channels: ['In-app', 'Email'], recipients: 'Supplier, Reviewer', reminderDays: [3, 1] },
  { id: 'tg-sample', event: 'Sample request status change', enabled: true, channels: ['In-app'], recipients: 'Requester, Supplier', reminderDays: [] },
  { id: 'tg-cap', event: 'Capability submitted or returned', enabled: true, channels: ['In-app', 'Email'], recipients: 'Central Authority, Buyer, Supplier', reminderDays: [] },
  { id: 'tg-qual', event: 'Qualification due for requalification', enabled: true, channels: ['In-app', 'Email'], recipients: 'Coordinator, Supplier', reminderDays: [60, 30] },
  { id: 'tg-qsl', event: 'QSL published, suspended or expired', enabled: true, channels: ['In-app', 'Email'], recipients: 'Buyer, Supplier', reminderDays: [] },
  { id: 'tg-int', event: 'Integration transaction failed', enabled: true, channels: ['In-app'], recipients: 'Admin', reminderDays: [] },
];

const templates = (): NotificationTemplate[] => [
  { id: 'tp-doc', triggerId: 'tg-doc', channel: 'Email', subject: '{{document}} expires in {{days}} days', body: 'Dear {{supplier}}, your {{document}} expires on {{expiryDate}}. Please upload a renewed document in the Supplier Portal.' },
  { id: 'tp-task', triggerId: 'tg-task', channel: 'Email', subject: 'New task: {{taskName}}', body: 'Dear {{supplier}}, a new task has been assigned to you and is due on {{dueDate}}. Open the Supplier Portal to respond.' },
  { id: 'tp-cap', triggerId: 'tg-cap', channel: 'Email', subject: 'Capability submission {{status}}', body: 'Dear {{supplier}}, your capability submission {{reference}} is now {{status}}. {{comment}}' },
  { id: 'tp-qsl', triggerId: 'tg-qsl', channel: 'In-app', subject: 'QSL status: {{status}}', body: '{{supplier}} is now {{status}} for {{category}}.' },
];

const access = (): AccessSettings => {
  const result: AccessSettings = {};
  ADMIN_ROLES.forEach(role => {
    const admin = role === 'Admin';
    const readOnly = role === 'Read Only';
    result[role] = {
      menus: Object.fromEntries(MENUS.map(menu => [menu, admin || (menu !== 'Administration' && (!readOnly || menu === 'Dashboard' || menu === 'Supplier Management')) ])),
      actions: Object.fromEntries(ACTIONS.map(action => [action, admin || (!readOnly && action !== 'Configure' && action !== 'Delete')])),
      scope: admin || role === 'Procurement Manager' ? 'All business units' : role === 'Read Only' ? 'Assigned suppliers' : 'Own business unit',
    };
  });
  return result;
};

export const defaultConfig = (): ConfigState => ({
  general: { organization: 'SLM Platform', legalEntity: 'Global Procurement Co.', language: 'English', dateFormat: 'DD MMM YYYY', timeZone: 'Asia/Bangkok', currency: 'USD' },
  lists: {
    businessUnits: items(['Global Procurement', 'Manufacturing', 'Food & Beverage', 'Logistics']),
    supplierTypes: items(['Manufacturer', 'Distributor', 'Service provider', 'Contract packer']),
    productCategories: items(['Food', 'Ingredient', 'Raw material', 'Packaging', 'Logistics services']),
    industryCategories: items(['Food & beverage', 'Chemicals', 'Packaging', 'Logistics', 'Electronics']),
    regions: items(['Asia Pacific', 'Europe', 'North America', 'Latin America', 'Middle East & Africa']),
    certificateTypes: items(['ISO 9001', 'ISO 14001', 'ISO 22000', 'FSSC 22000', 'Halal', 'GMP']),
    supplierStatuses: items(['Draft', 'Pending', 'Active', 'Suspended', 'Rejected'], true),
  },
  taskTypes: [
    { id: 'tt-form', name: 'Complete form or questionnaire', reviewWorkflow: 'Single reviewer', reviewerRole: 'Supplier Manager', dueDays: 14, reminderDaysBefore: 3, allowReturn: true, active: true },
    { id: 'tt-doc', name: 'Upload document', reviewWorkflow: 'Single reviewer', reviewerRole: 'Quality Analyst', dueDays: 10, reminderDaysBefore: 3, allowReturn: true, active: true },
    { id: 'tt-learn', name: 'E-learning', reviewWorkflow: 'Auto-accept', reviewerRole: '', dueDays: 30, reminderDaysBefore: 7, allowReturn: false, active: true },
    { id: 'tt-consent', name: 'Consent and policy acknowledgement', reviewWorkflow: 'Auto-accept', reviewerRole: '', dueDays: 7, reminderDaysBefore: 2, allowReturn: false, active: true },
    { id: 'tt-cap', name: 'Capability information', reviewWorkflow: 'Two-step review', reviewerRole: 'Central Authority', secondReviewerRole: 'Buyer', dueDays: 21, reminderDaysBefore: 5, allowReturn: true, active: true },
  ],
  taskTemplates: [
    { id: 'tm-1', name: 'Company profile update', taskTypeId: 'tt-form', instructions: 'Review and update your company profile.', requiredForms: 'Company profile form', requiredDocuments: '', active: true },
    { id: 'tm-2', name: 'ISO certificate renewal', taskTypeId: 'tt-doc', instructions: 'Upload a valid ISO certificate.', requiredForms: '', requiredDocuments: 'ISO certificate', active: true },
    { id: 'tm-3', name: 'Code of conduct acknowledgement', taskTypeId: 'tt-consent', instructions: 'Read and accept the supplier code of conduct.', requiredForms: '', requiredDocuments: '', active: true },
    { id: 'tm-4', name: 'Qualification information', taskTypeId: 'tt-form', instructions: 'Complete the qualification questionnaire and attach the supporting documents.', requiredForms: 'Qualification form', requiredDocuments: 'Certificates', active: true },
    { id: 'tm-5', name: 'Skill rating self-assessment', taskTypeId: 'tt-cap', instructions: 'Rate your skill level for each skill category and attach evidence.', requiredForms: 'Skill rating form', requiredDocuments: '', active: true },
    { id: 'tm-6', name: 'Product information', taskTypeId: 'tt-cap', instructions: 'Provide your product categories, range and specifications.', requiredForms: 'Product information form', requiredDocuments: 'Product specification', active: true },
    { id: 'tm-7', name: 'Rate card submission', taskTypeId: 'tt-cap', instructions: 'Submit your current rate card.', requiredForms: 'Rate card form', requiredDocuments: '', active: true },
  ],
  assignmentRules: [
    { id: 'ar-1', trigger: 'Onboarding approved', taskTypeId: 'tt-form', assignTo: 'Supplier owner', active: true },
    { id: 'ar-2', trigger: 'Document expiring in 60 days', taskTypeId: 'tt-doc', assignTo: 'Category owner', active: true },
  ],
  qualificationApproval: flow('Sequential', ['Central Approver']),
  capabilityApproval: flow('Parallel', ['Central Authority', 'Buyer']),
  qsl: {
    ratingScale: [
      { level: 1, label: 'Basic', description: 'Meets the minimum requirement' },
      { level: 2, label: 'Proficient', description: 'Consistently meets the requirement' },
      { level: 3, label: 'Advanced', description: 'Exceeds the requirement' },
    ],
    pendingCapabilityInvalidatesApproved: false, autoPublish: false, publishToPortal: true, requirePublisherConfirmation: true,
  },
  samples: samples(),
  risk: risk(),
  triggers: triggers(),
  templates: templates(),
  access: access(),
});

export const LIST_LABELS: Record<ListKey, string> = {
  businessUnits: 'Business units', supplierTypes: 'Supplier types', productCategories: 'Product categories', industryCategories: 'Industry categories',
  regions: 'Countries / regions', certificateTypes: 'Certificate types', supplierStatuses: 'Supplier statuses',
};
