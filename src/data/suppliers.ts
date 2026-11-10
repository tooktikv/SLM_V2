export type Supplier = {
  name: string;
  id: string;
  category: string;
  status: string;
  risk: string;
  perf: number;
  qual: string;
  owner: string;
  country: string;
  lastReview: string;
  taxId?: string;
  materialGroup?: string;
  productTypes?: string[];
  businessUnit?: string;
  region?: string;
  lastUpdated?: string;
  qualificationStatus?: 'Qualified' | 'Pending' | 'Expired' | 'Rejected';
  expiringDocuments?: number;
  expiredDocuments?: number;
  missingDocuments?: number;
  noDataDocuments?: number;
  segment?: 'Strategic' | 'Preferred' | 'Development';
  annualSpendUsdM?: number;
  complianceScore?: number;
};

export const suppliers: Supplier[] = [
  { name: 'Titan Industries Ltd', id: 'SUP-0012', category: 'Raw Materials', status: 'Active', risk: 'Critical', perf: 62, qual: 'Approved', owner: 'S. Chen', country: 'Germany', lastReview: 'Sep 2, 2024', taxId: 'DE-294817305', materialGroup: 'Industrial Metals', productTypes: ['Alloy sheets', 'Steel fasteners'], businessUnit: 'Industrial Materials', region: 'Europe', lastUpdated: '2024-09-02', qualificationStatus: 'Pending', expiringDocuments: 2, expiredDocuments: 0, missingDocuments: 1, noDataDocuments: 1, segment: 'Strategic', annualSpendUsdM: 18.4, complianceScore: 82 },
  { name: 'Apex Components Inc', id: 'SUP-0034', category: 'Electronics', status: 'Pending', risk: 'Medium Risk', perf: 81, qual: 'Pending', owner: 'M. Patel', country: 'Taiwan', lastReview: 'Aug 28, 2024', taxId: 'TW-53810427', materialGroup: 'Electronic Components', productTypes: ['Control boards', 'Sensors'], businessUnit: 'Control Systems', region: 'APAC', lastUpdated: '2024-08-28', qualificationStatus: 'Pending', expiringDocuments: 1, expiredDocuments: 0, missingDocuments: 0, segment: 'Development', annualSpendUsdM: 9.8, complianceScore: 76 },
  { name: 'GlobalTech Manufacturing', id: 'SUP-0051', category: 'Packaging', status: 'Active', risk: 'High Risk', perf: 74, qual: 'Approved', owner: 'L. Torres', country: 'Mexico', lastReview: 'Sep 1, 2024', taxId: 'MX-GTM8506219K2', materialGroup: 'Industrial Packaging', productTypes: ['Packaging film', 'Cartons'], businessUnit: 'Consumer Products', region: 'Americas', lastUpdated: '2024-09-01', qualificationStatus: 'Expired', expiringDocuments: 0, expiredDocuments: 1, missingDocuments: 0, segment: 'Strategic', annualSpendUsdM: 12.1, complianceScore: 91 },
  { name: 'PrimeParts Co.', id: 'SUP-0067', category: 'Mechanical', status: 'Active', risk: 'Low Risk', perf: 91, qual: 'Approved', owner: 'J. Kim', country: 'USA', lastReview: 'Aug 15, 2024', taxId: 'US-84-2710365', materialGroup: 'Fasteners & Bearings', productTypes: ['M8 bolts', 'Bearings'], businessUnit: 'Industrial Components', region: 'Americas', lastUpdated: '2024-08-15', qualificationStatus: 'Qualified', expiringDocuments: 0, expiredDocuments: 0, missingDocuments: 0, segment: 'Preferred', annualSpendUsdM: 7.6, complianceScore: 98 },
  { name: 'Vertex Systems', id: 'SUP-0089', category: 'IT Services', status: 'Draft', risk: 'Medium Risk', perf: 0, qual: 'Draft', owner: 'A. Singh', country: 'Thailand', lastReview: '—', taxId: '0105567089326', materialGroup: 'Technology Services', productTypes: ['Cloud hosting', 'Security support'], businessUnit: 'Enterprise IT', region: 'APAC', lastUpdated: '2024-09-06', qualificationStatus: 'Pending', expiringDocuments: 0, expiredDocuments: 0, missingDocuments: 2, segment: 'Development', annualSpendUsdM: 2.1, complianceScore: 65 },
  { name: 'Nordex Logistics', id: 'SUP-0103', category: 'Logistics', status: 'Active', risk: 'Low Risk', perf: 88, qual: 'Approved', owner: 'K. Hansen', country: 'Thailand', lastReview: 'Jul 30, 2024', taxId: '0105544103557', materialGroup: 'Freight Services', productTypes: ['Road freight', 'Warehousing'], businessUnit: 'Global Logistics', region: 'APAC', lastUpdated: '2024-07-30', qualificationStatus: 'Qualified', expiringDocuments: 0, expiredDocuments: 0, missingDocuments: 0, segment: 'Preferred', annualSpendUsdM: 6.7, complianceScore: 95 },
  { name: 'Chemcore Solutions', id: 'SUP-0118', category: 'Chemicals', status: 'Active', risk: 'High Risk', perf: 58, qual: 'Conditional', owner: 'R. Okafor', country: 'Nigeria', lastReview: 'Sep 3, 2024', taxId: 'NG-18420651-0001', materialGroup: 'Specialty Chemicals', productTypes: ['Solvents', 'Process additives'], businessUnit: 'Process Materials', region: 'Africa', lastUpdated: '2024-09-03', qualificationStatus: 'Rejected', expiringDocuments: 1, expiredDocuments: 1, missingDocuments: 1, segment: 'Development', annualSpendUsdM: 4.2, complianceScore: 54 },
  { name: 'Fastener World', id: 'SUP-0124', category: 'Mechanical', status: 'Active', risk: 'Low Risk', perf: 94, qual: 'Approved', owner: 'S. Chen', country: 'Thailand', lastReview: 'Aug 20, 2024', taxId: '0105549124783', materialGroup: 'Fasteners & Bearings', productTypes: ['Industrial screws', 'Nuts'], businessUnit: 'Industrial Components', region: 'APAC', lastUpdated: '2024-08-20', qualificationStatus: 'Qualified', expiringDocuments: 0, expiredDocuments: 0, missingDocuments: 0, segment: 'Preferred', annualSpendUsdM: 5.4, complianceScore: 96 },
  { name: 'BlueSky Plastics', id: 'SUP-0139', category: 'Packaging', status: 'Active', risk: 'Medium Risk', perf: 77, qual: 'Approved', owner: 'M. Patel', country: 'Thailand', lastReview: 'Aug 10, 2024', taxId: '0105547139662', materialGroup: 'Polymer Packaging', productTypes: ['PET resin', 'Plastic containers'], businessUnit: 'Consumer Products', region: 'APAC', lastUpdated: '2024-08-10', qualificationStatus: 'Qualified', expiringDocuments: 0, expiredDocuments: 0, missingDocuments: 0, segment: 'Preferred', annualSpendUsdM: 5.2, complianceScore: 94 },
  { name: 'SteelForce Europe', id: 'SUP-0142', category: 'Raw Materials', status: 'Rejected', risk: 'High Risk', perf: 41, qual: 'Fail', owner: 'L. Torres', country: 'Thailand', lastReview: 'Jul 12, 2024', taxId: '0105541142108', materialGroup: 'Steel Products', productTypes: ['Steel coils', 'Metal sheets'], businessUnit: 'Industrial Materials', region: 'APAC', lastUpdated: '2024-07-12', qualificationStatus: 'Rejected', expiringDocuments: 0, expiredDocuments: 1, missingDocuments: 0, segment: 'Development', annualSpendUsdM: 3.6, complianceScore: 48 },
];
