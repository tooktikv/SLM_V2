export type ComplianceGroup = 'Documents' | 'Contracts' | 'Audits' | 'Questionnaires' | 'Screening';
export type ComplianceStatus = 'Verified' | 'Expiring' | 'Expired' | 'Missing' | 'No data received' | 'Pending';

export type ComplianceItem = {
  name: string;
  group: ComplianceGroup;
  type: string;
  // Expiry date for documents and contracts; next due date or check for the other groups.
  expiry: string;
  daysLeft: number | null;
  status: ComplianceStatus;
  source: string;
  owner: string;
};

export type ComplianceCompany = {
  name: string;
  id: string;
  category: string;
  owner: string;
  compliance: number;
  lastSync: string;
  items: ComplianceItem[];
};

export const complianceGroups: { group: ComplianceGroup; title: string; summary: string; trigger: string }[] = [
  { group: 'Documents', title: 'Documents & certificates', summary: 'ISO certificates, insurance, permits and regulatory declarations', trigger: 'Expiry date · reminders at 90 / 60 / 30 days' },
  { group: 'Contracts', title: 'Contracts & agreements', summary: 'Supply agreements, quality agreements and NDAs', trigger: 'Validity end date · renewal workflow' },
  { group: 'Audits', title: 'Audits & inspections', summary: 'Scheduled audits and closure of open findings', trigger: 'Audit date or action due date' },
  { group: 'Questionnaires', title: 'Questionnaires & declarations', summary: 'ESG self-assessments and supplier self-declarations', trigger: 'Annual submission deadline' },
  { group: 'Screening', title: 'Screening & monitoring', summary: 'Sanctions, watchlist and adverse media checks', trigger: 'Periodic re-screen or alert review' },
];

const generalStatusLabel: Record<ComplianceStatus, string> = { Verified: 'Compliant', Expiring: 'Due soon', Expired: 'Overdue', Missing: 'Not submitted', Pending: 'In progress', 'No data received': 'No data received' };

// Documents keep the registry wording; other groups use due-date wording.
export const itemStatusLabel = (item: ComplianceItem) => (item.group === 'Documents' ? item.status : generalStatusLabel[item.status]);

export const needsAttention = (item: ComplianceItem) => item.status === 'Expiring' || item.status === 'Expired' || item.status === 'Missing' || item.status === 'No data received';

type ItemRow = Omit<ComplianceItem, 'group'>;
const inGroup = (group: ComplianceGroup, rows: ItemRow[]): ComplianceItem[] => rows.map(row => ({ ...row, group }));

const sanctionsCheck: ItemRow = { name: 'Sanctions & watchlist screening', type: 'Periodic check', expiry: 'Oct 1, 2024', daysLeft: 21, status: 'Verified', source: 'ScreenPro', owner: 'Compliance' };
const esgAssessmentDone: ItemRow = { name: 'ESG self-assessment 2024', type: 'Annual questionnaire', expiry: 'Dec 15, 2024', daysLeft: 96, status: 'Verified', source: 'ESG Hub', owner: 'ESG' };

export const complianceCompanies: ComplianceCompany[] = [
  { name: 'Titan Industries Ltd', id: 'SUP-0012', category: 'Raw Materials', owner: 'S. Chen', compliance: 82, lastSync: 'Today, 10:42', items: [
    ...inGroup('Documents', [
    { name: 'ISO 9001:2015', type: 'Quality certification', expiry: 'Jan 12, 2025', daysLeft: 124, status: 'Verified', source: 'CertCheck', owner: 'Quality' },
    { name: 'ISO 14001:2015', type: 'Environmental certification', expiry: 'Dec 1, 2024', daysLeft: 83, status: 'Expiring', source: 'CertCheck', owner: 'ESG' },
    { name: 'Public Liability Insurance', type: 'Insurance', expiry: 'Oct 8, 2024', daysLeft: 28, status: 'Expiring', source: 'RiskVerify', owner: 'Legal' },
    { name: 'Conflict Minerals Declaration', type: 'Regulatory', expiry: '—', daysLeft: null, status: 'Missing', source: 'ESG Hub', owner: 'Compliance' },
    { name: 'Supplier Diversity Declaration', type: 'ESG data', expiry: '—', daysLeft: null, status: 'No data received', source: 'ESG Hub', owner: 'Compliance' },
    ]),
    ...inGroup('Contracts', [
      { name: 'Master Supply Agreement', type: 'Commercial contract', expiry: 'Mar 31, 2025', daysLeft: 202, status: 'Verified', source: 'Contract Hub', owner: 'Procurement' },
      { name: 'Quality Agreement', type: 'Quality contract', expiry: 'Dec 31, 2024', daysLeft: 112, status: 'Verified', source: 'Contract Hub', owner: 'Quality' },
      { name: 'Non-Disclosure Agreement', type: 'Legal contract', expiry: 'Nov 15, 2024', daysLeft: 66, status: 'Expiring', source: 'Contract Hub', owner: 'Legal' },
    ]),
    ...inGroup('Audits', [
      { name: 'Annual quality system audit', type: 'On-site audit', expiry: 'Jan 20, 2025', daysLeft: 132, status: 'Pending', source: 'Audit module', owner: 'Quality' },
      { name: 'Audit findings closure (3 open)', type: 'Corrective actions', expiry: 'Sep 30, 2024', daysLeft: 20, status: 'Expiring', source: 'Audit module', owner: 'Quality' },
    ]),
    ...inGroup('Questionnaires', [
      { name: 'ESG self-assessment 2024', type: 'Annual questionnaire', expiry: 'Oct 31, 2024', daysLeft: 51, status: 'Pending', source: 'ESG Hub', owner: 'ESG' },
    ]),
    ...inGroup('Screening', [
      sanctionsCheck,
      { name: 'Adverse media monitoring', type: 'Continuous monitoring', expiry: 'Continuous', daysLeft: null, status: 'Verified', source: 'ScreenPro', owner: 'Compliance' },
    ]),
  ]},
  { name: 'Chemcore Solutions', id: 'SUP-0118', category: 'Chemicals', owner: 'R. Okafor', compliance: 54, lastSync: 'Today, 09:18', items: [
    ...inGroup('Documents', [
    { name: 'REACH Compliance Declaration', type: 'Regulatory', expiry: 'Mar 5, 2024', daysLeft: -189, status: 'Expired', source: 'RegData', owner: 'Compliance' },
    { name: 'Hazardous Materials Permit', type: 'Operating permit', expiry: 'Sep 28, 2024', daysLeft: 18, status: 'Expiring', source: 'RegData', owner: 'EHS' },
    { name: 'ESG Policy Statement', type: 'Policy', expiry: '—', daysLeft: null, status: 'Missing', source: 'ESG Hub', owner: 'ESG' },
    ]),
    ...inGroup('Contracts', [
      { name: 'Master Supply Agreement', type: 'Commercial contract', expiry: 'Jan 31, 2025', daysLeft: 143, status: 'Verified', source: 'Contract Hub', owner: 'Procurement' },
      { name: 'Quality Agreement', type: 'Quality contract', expiry: '—', daysLeft: null, status: 'Missing', source: 'Contract Hub', owner: 'Quality' },
    ]),
    ...inGroup('Audits', [
      { name: 'EHS site audit', type: 'On-site audit', expiry: 'Aug 30, 2024', daysLeft: -11, status: 'Expired', source: 'Audit module', owner: 'EHS' },
      { name: 'Audit findings closure (5 open)', type: 'Corrective actions', expiry: 'Sep 20, 2024', daysLeft: 10, status: 'Expiring', source: 'Audit module', owner: 'EHS' },
    ]),
    ...inGroup('Questionnaires', [
      { name: 'Sustainability questionnaire 2024', type: 'Annual questionnaire', expiry: '—', daysLeft: null, status: 'No data received', source: 'ESG Hub', owner: 'ESG' },
    ]),
    ...inGroup('Screening', [
      sanctionsCheck,
      { name: 'Adverse media alert (1 to review)', type: 'Alert review', expiry: 'Sep 14, 2024', daysLeft: 4, status: 'Expiring', source: 'ScreenPro', owner: 'Compliance' },
    ]),
  ]},
  { name: 'GlobalTech Manufacturing', id: 'SUP-0051', category: 'Packaging', owner: 'L. Torres', compliance: 91, lastSync: 'Today, 10:05', items: [
    ...inGroup('Documents', [
    { name: 'ISO 14001:2015', type: 'Environmental certification', expiry: 'Feb 14, 2025', daysLeft: 157, status: 'Verified', source: 'CertCheck', owner: 'ESG' },
    { name: 'Conflict Minerals Declaration', type: 'Regulatory', expiry: 'Feb 14, 2025', daysLeft: 157, status: 'Verified', source: 'ESG Hub', owner: 'Compliance' },
    ]),
    ...inGroup('Contracts', [
      { name: 'Master Supply Agreement', type: 'Commercial contract', expiry: 'Dec 31, 2024', daysLeft: 112, status: 'Verified', source: 'Contract Hub', owner: 'Procurement' },
      { name: 'Packaging Quality Agreement', type: 'Quality contract', expiry: 'Jun 30, 2025', daysLeft: 293, status: 'Verified', source: 'Contract Hub', owner: 'Quality' },
    ]),
    ...inGroup('Audits', [
      { name: 'Annual quality audit', type: 'On-site audit', expiry: 'Feb 10, 2025', daysLeft: 153, status: 'Pending', source: 'Audit module', owner: 'Quality' },
    ]),
    ...inGroup('Questionnaires', [esgAssessmentDone]),
    ...inGroup('Screening', [sanctionsCheck]),
  ]},
  { name: 'Apex Components Inc', id: 'SUP-0034', category: 'Electronics', owner: 'M. Patel', compliance: 76, lastSync: 'Yesterday, 18:20', items: [
    ...inGroup('Documents', [
    { name: 'Supplier Code of Conduct', type: 'Policy', expiry: '—', daysLeft: null, status: 'Pending', source: 'VendorVerify', owner: 'Procurement' },
    { name: 'RoHS Declaration', type: 'Regulatory', expiry: 'Nov 2, 2024', daysLeft: 53, status: 'Expiring', source: 'RegData', owner: 'Compliance' },
    { name: 'Cyber Insurance', type: 'Insurance', expiry: 'Apr 12, 2025', daysLeft: 214, status: 'Verified', source: 'RiskVerify', owner: 'IT Risk' },
    ]),
    ...inGroup('Contracts', [
      { name: 'Non-Disclosure Agreement', type: 'Legal contract', expiry: 'Sep 30, 2024', daysLeft: 20, status: 'Expiring', source: 'Contract Hub', owner: 'Legal' },
      { name: 'Master Supply Agreement', type: 'Commercial contract', expiry: '—', daysLeft: null, status: 'Pending', source: 'Contract Hub', owner: 'Procurement' },
    ]),
    ...inGroup('Audits', [
      { name: 'Pre-qualification site audit', type: 'On-site audit', expiry: 'Sep 25, 2024', daysLeft: 15, status: 'Pending', source: 'Audit module', owner: 'Quality' },
    ]),
    ...inGroup('Questionnaires', [
      { name: 'Supplier self-assessment', type: 'Onboarding questionnaire', expiry: 'Oct 15, 2024', daysLeft: 35, status: 'Pending', source: 'ESG Hub', owner: 'ESG' },
    ]),
    ...inGroup('Screening', [sanctionsCheck]),
  ]},
  { name: 'PrimeParts Co.', id: 'SUP-0067', category: 'Mechanical', owner: 'J. Kim', compliance: 98, lastSync: 'Today, 08:55', items: [
    ...inGroup('Documents', [
    { name: 'IATF 16949', type: 'Quality certification', expiry: 'Jul 1, 2026', daysLeft: 664, status: 'Verified', source: 'CertCheck', owner: 'Quality' },
    { name: 'Product Liability Insurance', type: 'Insurance', expiry: 'Jun 20, 2025', daysLeft: 283, status: 'Verified', source: 'RiskVerify', owner: 'Legal' },
    ]),
    ...inGroup('Contracts', [
      { name: 'Master Supply Agreement', type: 'Commercial contract', expiry: 'Sep 30, 2025', daysLeft: 385, status: 'Verified', source: 'Contract Hub', owner: 'Procurement' },
    ]),
    ...inGroup('Audits', [
      { name: 'Annual quality audit (last result: Pass)', type: 'On-site audit', expiry: 'Mar 12, 2025', daysLeft: 183, status: 'Verified', source: 'Audit module', owner: 'Quality' },
    ]),
    ...inGroup('Questionnaires', [esgAssessmentDone]),
    ...inGroup('Screening', [sanctionsCheck]),
  ]},
];

export function daysLabel(days: number | null) {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days}d left`;
}
