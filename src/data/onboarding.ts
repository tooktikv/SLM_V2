export type DocumentStatus = 'Verified' | 'Under review' | 'Missing' | 'Rejected';

export type OnboardingCompany = {
  name: string;
  id: string;
  category: string;
  country: string;
  requestType: string;
  owner: string;
  step: string;
  progress: number;
  started: string;
  days: number;
  source: string;
  lastSync: string;
  syncStatus: 'Synced' | 'Sync delayed';
  documents: { name: string; required: boolean; status: DocumentStatus; updated: string; note: string }[];
};

export const onboardingCompanies: OnboardingCompany[] = [
  {
    name: 'Apex Components Inc',
    id: 'SUP-0034',
    category: 'Electronics',
    country: 'Taiwan',
    requestType: 'New supplier',
    owner: 'M. Patel',
    step: 'Documents',
    progress: 42,
    started: 'Sep 1, 2024',
    days: 8,
    source: 'VendorVerify',
    lastSync: 'Today, 10:42',
    syncStatus: 'Synced',
    documents: [
      { name: 'Certificate of Incorporation', required: true, status: 'Verified', updated: 'Sep 3', note: 'Verified by VendorVerify' },
      { name: 'Tax Registration Certificate', required: true, status: 'Verified', updated: 'Sep 3', note: 'Verified by VendorVerify' },
      { name: 'ISO 9001 Certificate', required: true, status: 'Under review', updated: 'Sep 7', note: 'Submitted to third-party verifier' },
      { name: 'Bank Reference Letter', required: true, status: 'Missing', updated: '—', note: 'Not received from supplier' },
      { name: 'Financial Statements (2 years)', required: true, status: 'Missing', updated: '—', note: 'Not received from supplier' },
      { name: 'Insurance Certificate', required: false, status: 'Verified', updated: 'Sep 4', note: 'Verified by VendorVerify' },
      { name: 'ESG Policy Statement', required: false, status: 'Missing', updated: '—', note: 'Optional document' },
    ],
  },
  {
    name: 'Vertex Systems',
    id: 'SUP-0089',
    category: 'IT Services',
    country: 'Thailand',
    requestType: 'New supplier',
    owner: 'A. Singh',
    step: 'Registration',
    progress: 15,
    started: 'Sep 6, 2024',
    days: 3,
    source: 'TrustDocs',
    lastSync: 'Today, 10:38',
    syncStatus: 'Synced',
    documents: [
      { name: 'Certificate of Incorporation', required: true, status: 'Under review', updated: 'Sep 8', note: 'Submitted to TrustDocs' },
      { name: 'Tax Registration Certificate', required: true, status: 'Missing', updated: '—', note: 'Not received from supplier' },
      { name: 'Information Security Policy', required: true, status: 'Missing', updated: '—', note: 'Not received from supplier' },
      { name: 'Cyber Insurance Certificate', required: true, status: 'Missing', updated: '—', note: 'Not received from supplier' },
    ],
  },
  {
    name: 'Nortech AG',
    id: 'SUP-0156',
    category: 'Industrial Equipment',
    country: 'Switzerland',
    requestType: 'Requalification',
    owner: 'K. Bauer',
    step: 'Qualification',
    progress: 68,
    started: 'Aug 26, 2024',
    days: 14,
    source: 'VendorVerify',
    lastSync: 'Yesterday, 18:10',
    syncStatus: 'Sync delayed',
    documents: [
      { name: 'Certificate of Incorporation', required: true, status: 'Verified', updated: 'Aug 28', note: 'Verified by VendorVerify' },
      { name: 'Tax Registration Certificate', required: true, status: 'Verified', updated: 'Aug 28', note: 'Verified by VendorVerify' },
      { name: 'ISO 9001 Certificate', required: true, status: 'Verified', updated: 'Aug 30', note: 'Verified by VendorVerify' },
      { name: 'Financial Statements (2 years)', required: true, status: 'Verified', updated: 'Sep 1', note: 'Verified by VendorVerify' },
      { name: 'Product Liability Insurance', required: true, status: 'Rejected', updated: 'Sep 6', note: 'Coverage value below requirement' },
    ],
  },
  {
    name: 'Solaris Parts',
    id: 'SUP-0177',
    category: 'Mechanical',
    country: 'Spain',
    requestType: 'New supplier',
    owner: 'J. Kim',
    step: 'Review',
    progress: 82,
    started: 'Aug 20, 2024',
    days: 20,
    source: 'TrustDocs',
    lastSync: 'Today, 09:55',
    syncStatus: 'Synced',
    documents: [
      { name: 'Certificate of Incorporation', required: true, status: 'Verified', updated: 'Aug 22', note: 'Verified by TrustDocs' },
      { name: 'Tax Registration Certificate', required: true, status: 'Verified', updated: 'Aug 22', note: 'Verified by TrustDocs' },
      { name: 'ISO 9001 Certificate', required: true, status: 'Verified', updated: 'Aug 25', note: 'Verified by TrustDocs' },
      { name: 'Financial Statements (2 years)', required: true, status: 'Verified', updated: 'Aug 27', note: 'Verified by TrustDocs' },
      { name: 'Insurance Certificate', required: true, status: 'Under review', updated: 'Sep 8', note: 'Submitted to TrustDocs' },
    ],
  },
  {
    name: 'Eastgate Manufacturing',
    id: 'SUP-0184',
    category: 'Packaging',
    country: 'Vietnam',
    requestType: 'New supplier',
    owner: 'S. Chen',
    step: 'Approval',
    progress: 91,
    started: 'Aug 18, 2024',
    days: 22,
    source: 'VendorVerify',
    lastSync: 'Today, 10:40',
    syncStatus: 'Synced',
    documents: [
      { name: 'Certificate of Incorporation', required: true, status: 'Verified', updated: 'Aug 20', note: 'Verified by VendorVerify' },
      { name: 'Tax Registration Certificate', required: true, status: 'Verified', updated: 'Aug 20', note: 'Verified by VendorVerify' },
      { name: 'ISO 9001 Certificate', required: true, status: 'Verified', updated: 'Aug 23', note: 'Verified by VendorVerify' },
      { name: 'Financial Statements (2 years)', required: true, status: 'Verified', updated: 'Aug 24', note: 'Verified by VendorVerify' },
      { name: 'Insurance Certificate', required: true, status: 'Verified', updated: 'Aug 24', note: 'Verified by VendorVerify' },
    ],
  },
];

export const stepNames = ['Registration', 'Information', 'Documents', 'Qualification', 'Review', 'Approval', 'Activated'];
export const statusHistory: Record<string, { date: string; status: string; source: string }[]> = {
  'SUP-0034': [{ date: 'Sep 1, 2024', status: 'Registration received', source: 'VendorVerify' }, { date: 'Sep 2, 2024', status: 'Company information verified', source: 'VendorVerify' }, { date: 'Sep 3, 2024', status: 'Document collection started', source: 'VendorVerify' }],
  'SUP-0089': [{ date: 'Sep 6, 2024', status: 'Registration received', source: 'TrustDocs' }, { date: 'Sep 8, 2024', status: 'Registration review started', source: 'TrustDocs' }],
  'SUP-0156': [{ date: 'Aug 26, 2024', status: 'Requalification requested', source: 'VendorVerify' }, { date: 'Aug 30, 2024', status: 'Documents verified', source: 'VendorVerify' }, { date: 'Sep 6, 2024', status: 'Insurance evidence rejected', source: 'VendorVerify' }],
  'SUP-0177': [{ date: 'Aug 20, 2024', status: 'Registration received', source: 'TrustDocs' }, { date: 'Aug 27, 2024', status: 'Document review completed', source: 'TrustDocs' }, { date: 'Sep 4, 2024', status: 'Internal approval review started', source: 'TrustDocs' }],
  'SUP-0184': [{ date: 'Aug 18, 2024', status: 'Registration received', source: 'VendorVerify' }, { date: 'Aug 24, 2024', status: 'Required documents verified', source: 'VendorVerify' }, { date: 'Sep 8, 2024', status: 'Approval submitted', source: 'VendorVerify' }],
};
