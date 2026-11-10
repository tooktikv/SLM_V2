export type SampleStatus = 'Requested' | 'In transit' | 'Received' | 'Under testing' | 'Approved' | 'Conditional' | 'Rejected';
export type SamplePurpose = 'Onboarding evaluation' | 'New product' | 'Re-qualification' | 'Batch verification' | 'Cost reduction';

export type SampleRequest = {
  id: string;
  product: string;
  spec: string;
  purpose: SamplePurpose;
  requester: string;
  department: string;
  qty: string;
  requested: string;
  required: string;
  // Days until the required-by date; null once the request has a decision.
  daysLeft: number | null;
  status: SampleStatus;
  note: string;
  evaluator?: string;
  events?: { date: string; event: string }[];
  // Optional fields added for the Supplier Portal integration. Existing records do not need them.
  typeId?: string;
  requirements?: string[];
  delivery?: SampleDelivery;
  evaluation?: SampleEvaluation;
  portal?: { sync: 'Draft' | 'Sent' | 'Failed'; transactionId?: string };
  requiredIso?: string;
  retests?: number;
  closedAt?: string;
};

type SampleDelivery = { confirmedAt?: string; carrier?: string; trackingNo?: string; shippedAt?: string; expectedAt?: string; receivedAt?: string };
type SampleScore = { criterionId: string; name: string; passMark: number; score: number; comment: string };
type SampleEvaluation = { scores: SampleScore[]; result: string; outcome: 'Accept' | 'Fail' | 'Retest'; comment: string; by: string; at: string };

export const sampleStatuses: SampleStatus[] = ['Requested', 'In transit', 'Received', 'Under testing', 'Approved', 'Conditional', 'Rejected'];
export const samplePurposes: SamplePurpose[] = ['Onboarding evaluation', 'New product', 'Re-qualification', 'Batch verification', 'Cost reduction'];
export const sampleStages = ['Requested', 'Shipped', 'Received', 'Testing', 'Decision'];

export const isSampleOpen = (sample: SampleRequest) => sample.status === 'Requested' || sample.status === 'In transit' || sample.status === 'Received' || sample.status === 'Under testing';

export const sampleStage = (status: SampleStatus) => ({ Requested: 1, 'In transit': 2, Received: 3, 'Under testing': 4, Approved: 5, Conditional: 5, Rejected: 5 })[status];

// Keyed by supplier ID.
export const sampleRequests: Record<string, SampleRequest[]> = {
  'SUP-0012': [
    { id: 'SR-2024-0147', product: 'Alloy sheet AL-6082', spec: '4 mm · EN 573-3', purpose: 'New product', requester: 'J. Kim', department: 'R&D', qty: '6 pcs', requested: 'Sep 9, 2024', required: 'Sep 27, 2024', daysLeft: 17, status: 'Requested', note: 'Awaiting supplier confirmation', events: [{ date: 'Sep 9, 2024', event: 'Sample requested by buyer' }] },
    { id: 'SR-2024-0146', product: 'Steel fastener M10', spec: 'A2-70 · DIN 933', purpose: 'Batch verification', requester: 'S. Chen', department: 'Quality', qty: '200 pcs', requested: 'Sep 8, 2024', required: 'Sep 24, 2024', daysLeft: 14, status: 'Requested', note: 'Awaiting supplier confirmation', events: [{ date: 'Sep 8, 2024', event: 'Sample requested by buyer' }] },
    { id: 'SR-2024-0142', product: 'Alloy sheet AL-6061', spec: '3 mm · EN 573-3', purpose: 'New product', requester: 'J. Kim', department: 'R&D', qty: '10 pcs', requested: 'Aug 28, 2024', required: 'Sep 6, 2024', daysLeft: -4, status: 'In transit', note: 'Shipped Sep 2 · DHL 884213', events: [{ date: 'Aug 28, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 30, 2024', event: 'Supplier confirmed shipment date' }, { date: 'Sep 2, 2024', event: 'Shipped, tracking number issued' }] },
    { id: 'SR-2024-0139', product: 'Steel fastener M8', spec: 'A2-70 · DIN 933', purpose: 'Batch verification', requester: 'S. Chen', department: 'Quality', qty: '200 pcs', requested: 'Aug 22, 2024', required: 'Sep 12, 2024', daysLeft: 2, status: 'Under testing', note: 'Pull test in progress · LR-2241', evaluator: 'Quality Lab', events: [{ date: 'Aug 22, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 27, 2024', event: 'Shipped by supplier' }, { date: 'Sep 2, 2024', event: 'Received at Quality Lab' }, { date: 'Sep 4, 2024', event: 'Pull test started' }] },
    { id: 'SR-2024-0136', product: 'Alloy sheet AL-5052', spec: '2 mm · EN 573-3', purpose: 'Cost reduction', requester: 'M. Patel', department: 'Procurement', qty: '8 pcs', requested: 'Aug 15, 2024', required: 'Sep 15, 2024', daysLeft: 5, status: 'Received', note: 'Received Sep 5 · waiting for lab slot', evaluator: 'Quality Lab', events: [{ date: 'Aug 15, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 29, 2024', event: 'Shipped by supplier' }, { date: 'Sep 5, 2024', event: 'Received at plant' }] },
    { id: 'SR-2024-0131', product: 'Hex bolt M10', spec: 'Grade 8.8 · ISO 4014', purpose: 'Re-qualification', requester: 'D. Park', department: 'Quality', qty: '100 pcs', requested: 'Aug 6, 2024', required: 'Aug 30, 2024', daysLeft: null, status: 'Approved', note: 'LR-2198 · Within tolerance' },
    { id: 'SR-2024-0127', product: 'Alloy sheet AL-6061', spec: '5 mm · EN 573-3', purpose: 'New product', requester: 'J. Kim', department: 'R&D', qty: '6 pcs', requested: 'Jul 29, 2024', required: 'Aug 23, 2024', daysLeft: null, status: 'Conditional', note: 'LR-2187 · Surface finish deviation 0.04 mm' },
    { id: 'SR-2024-0121', product: 'Stainless washer', spec: 'A4 · DIN 125', purpose: 'Batch verification', requester: 'S. Chen', department: 'Quality', qty: '500 pcs', requested: 'Jul 18, 2024', required: 'Aug 12, 2024', daysLeft: null, status: 'Approved', note: 'LR-2169 · Pass' },
    { id: 'SR-2024-0118', product: 'Steel fastener M12', spec: 'Grade 10.9 · DIN 931', purpose: 'Cost reduction', requester: 'M. Patel', department: 'Procurement', qty: '150 pcs', requested: 'Jul 10, 2024', required: 'Aug 2, 2024', daysLeft: null, status: 'Rejected', note: 'LR-2154 · Tensile strength below spec' },
    { id: 'SR-2024-0112', product: 'Alloy sheet AL-7075', spec: '3 mm · EN 573-3', purpose: 'New product', requester: 'J. Kim', department: 'R&D', qty: '4 pcs', requested: 'Jun 27, 2024', required: 'Jul 22, 2024', daysLeft: null, status: 'Approved', note: 'LR-2140 · Pass' },
    { id: 'SR-2024-0105', product: 'Threaded rod M6', spec: 'Zinc plated · DIN 975', purpose: 'Batch verification', requester: 'D. Park', department: 'Quality', qty: '300 pcs', requested: 'Jun 14, 2024', required: 'Jul 8, 2024', daysLeft: null, status: 'Approved', note: 'LR-2122 · Pass' },
    { id: 'SR-2024-0098', product: 'Alloy sheet AL-3003', spec: '1.5 mm · EN 573-3', purpose: 'Re-qualification', requester: 'S. Chen', department: 'Quality', qty: '10 pcs', requested: 'Jun 3, 2024', required: 'Jun 28, 2024', daysLeft: null, status: 'Approved', note: 'LR-2105 · Pass' },
    { id: 'SR-2024-0091', product: 'Steel fastener M8', spec: 'A4-80 · DIN 933', purpose: 'New product', requester: 'J. Kim', department: 'R&D', qty: '200 pcs', requested: 'May 20, 2024', required: 'Jun 14, 2024', daysLeft: null, status: 'Rejected', note: 'LR-2088 · Coating thickness out of range' },
    { id: 'SR-2024-0084', product: 'Anchor bolt M16', spec: 'HDG · ETAG 001', purpose: 'Cost reduction', requester: 'M. Patel', department: 'Procurement', qty: '80 pcs', requested: 'May 8, 2024', required: 'Jun 1, 2024', daysLeft: null, status: 'Approved', note: 'LR-2071 · Pass' },
  ],
  'SUP-0034': [
    { id: 'SR-2024-0149', product: 'Control board assembly', spec: 'CB-210 Rev C · 24 V', purpose: 'Onboarding evaluation', requester: 'M. Patel', department: 'Procurement', qty: '5 units', requested: 'Sep 3, 2024', required: 'Sep 12, 2024', daysLeft: 2, status: 'In transit', note: 'Shipment dispatched; evaluation starts on receipt', evaluator: 'Electronics Lab', events: [{ date: 'Sep 3, 2024', event: 'Sample requested by buyer' }, { date: 'Sep 5, 2024', event: 'Supplier confirmed shipment date' }, { date: 'Sep 7, 2024', event: 'Shipped, tracking number issued' }] },
    { id: 'SR-2024-0150', product: 'Pressure sensor PS-12', spec: '0–10 bar · IP67', purpose: 'Onboarding evaluation', requester: 'K. Tan', department: 'Quality', qty: '20 units', requested: 'Sep 5, 2024', required: 'Oct 4, 2024', daysLeft: 24, status: 'Requested', note: 'Awaiting supplier confirmation', events: [{ date: 'Sep 5, 2024', event: 'Sample requested by buyer' }] },
  ],
  'SUP-0051': [
    { id: 'SR-2024-0143', product: 'Shrink film SF-25', spec: '25 µm · 450 mm roll', purpose: 'Cost reduction', requester: 'L. Torres', department: 'Procurement', qty: '4 rolls', requested: 'Aug 29, 2024', required: 'Sep 16, 2024', daysLeft: 6, status: 'Under testing', note: 'Seal strength test · LR-2246', evaluator: 'Packaging Lab', events: [{ date: 'Aug 29, 2024', event: 'Sample requested by buyer' }, { date: 'Sep 2, 2024', event: 'Shipped by supplier' }, { date: 'Sep 5, 2024', event: 'Received at plant' }, { date: 'Sep 7, 2024', event: 'Seal strength test started' }] },
    { id: 'SR-2024-0116', product: 'Packaging film PF-40', spec: '40 µm · food grade', purpose: 'New product', requester: 'A. Rossi', department: 'Packaging', qty: '6 rolls', requested: 'Jul 8, 2024', required: 'Aug 5, 2024', daysLeft: null, status: 'Approved', note: 'LR-2149 · Pass' },
    { id: 'SR-2024-0102', product: 'Corrugated carton C-52', spec: '5-ply · 400×300×250 mm', purpose: 'Batch verification', requester: 'A. Rossi', department: 'Packaging', qty: '100 pcs', requested: 'Jun 10, 2024', required: 'Jul 1, 2024', daysLeft: null, status: 'Approved', note: 'LR-2113 · Pass' },
  ],
  'SUP-0067': [
    { id: 'SR-2024-0145', product: 'Needle bearing NK-25', spec: '25×35×20 mm', purpose: 'Cost reduction', requester: 'J. Kim', department: 'Procurement', qty: '50 pcs', requested: 'Aug 20, 2024', required: 'Sep 13, 2024', daysLeft: 3, status: 'Received', note: 'Received Sep 6 · dimensional check queued', evaluator: 'Quality Lab', events: [{ date: 'Aug 20, 2024', event: 'Sample requested by buyer' }, { date: 'Sep 3, 2024', event: 'Shipped by supplier' }, { date: 'Sep 6, 2024', event: 'Received at plant' }] },
    { id: 'SR-2024-0128', product: 'Ball bearing 6204', spec: '2RS · C3', purpose: 'Batch verification', requester: 'D. Park', department: 'Quality', qty: '100 pcs', requested: 'Jul 30, 2024', required: 'Aug 22, 2024', daysLeft: null, status: 'Approved', note: 'LR-2191 · Pass' },
    { id: 'SR-2024-0097', product: 'M8 bolt', spec: 'Grade 10.9 · ISO 4017', purpose: 'Re-qualification', requester: 'D. Park', department: 'Quality', qty: '200 pcs', requested: 'Jun 2, 2024', required: 'Jun 26, 2024', daysLeft: null, status: 'Approved', note: 'LR-2101 · Pass' },
  ],
  'SUP-0118': [
    { id: 'SR-2024-0148', product: 'Process additive PA-9', spec: 'Liquid · 5 L', purpose: 'Re-qualification', requester: 'R. Okafor', department: 'Procurement', qty: '5 L', requested: 'Sep 3, 2024', required: 'Sep 20, 2024', daysLeft: 10, status: 'Under testing', note: 'Viscosity and purity test · LR-2252', evaluator: 'EHS Lab', events: [{ date: 'Sep 3, 2024', event: 'Sample requested by buyer' }, { date: 'Sep 6, 2024', event: 'Received at plant' }, { date: 'Sep 9, 2024', event: 'Viscosity and purity test started' }] },
    { id: 'SR-2024-0138', product: 'Solvent S-220', spec: '99.5% · 20 L', purpose: 'Batch verification', requester: 'E. Nwosu', department: 'EHS', qty: '20 L', requested: 'Aug 19, 2024', required: 'Sep 2, 2024', daysLeft: null, status: 'Rejected', note: 'LR-2230 · Purity 97.8%, below 99.5% spec' },
    { id: 'SR-2024-0120', product: 'Solvent S-180', spec: '98% · 20 L', purpose: 'Cost reduction', requester: 'R. Okafor', department: 'Procurement', qty: '20 L', requested: 'Jul 16, 2024', required: 'Aug 9, 2024', daysLeft: null, status: 'Conditional', note: 'LR-2161 · Moisture slightly above limit' },
  ],
  'SUP-0177': [
    { id: 'SR-2024-0137', product: 'Precision gear set', spec: 'Module 2 · 20 teeth', purpose: 'Onboarding evaluation', requester: 'J. Kim', department: 'Procurement', qty: '10 units', requested: 'Aug 22, 2024', required: 'Aug 30, 2024', daysLeft: null, status: 'Approved', note: 'Approved for production trial', evaluator: 'Quality Lab', events: [{ date: 'Aug 22, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 26, 2024', event: 'Shipped by supplier' }, { date: 'Aug 29, 2024', event: 'Received at plant' }, { date: 'Sep 3, 2024', event: 'Evaluation completed' }, { date: 'Sep 4, 2024', event: 'Approved for production trial' }] },
  ],
  'SUP-0184': [
    { id: 'SR-2024-0134', product: 'Recyclable packaging film', spec: 'Mono-material PE', purpose: 'Onboarding evaluation', requester: 'S. Chen', department: 'Procurement', qty: '2 rolls', requested: 'Aug 19, 2024', required: 'Aug 28, 2024', daysLeft: null, status: 'Approved', note: 'Passed material and seal-strength tests', evaluator: 'Packaging Lab', events: [{ date: 'Aug 19, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 25, 2024', event: 'Received at plant' }, { date: 'Sep 2, 2024', event: 'Evaluation completed' }, { date: 'Sep 3, 2024', event: 'Approved' }] },
    { id: 'SR-2024-0133', product: 'Corrugated carton B-flute', spec: '3-ply · 400×300×250 mm', purpose: 'Onboarding evaluation', requester: 'S. Chen', department: 'Procurement', qty: '20 units', requested: 'Aug 18, 2024', required: 'Aug 27, 2024', daysLeft: null, status: 'Rejected', note: 'Burst strength below specification', evaluator: 'Packaging Lab', events: [{ date: 'Aug 18, 2024', event: 'Sample requested by buyer' }, { date: 'Aug 24, 2024', event: 'Received at plant' }, { date: 'Aug 30, 2024', event: 'Burst strength test failed' }, { date: 'Aug 31, 2024', event: 'Rejected, resubmission requested' }] },
  ],
};
