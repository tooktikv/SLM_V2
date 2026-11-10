// MOCK: supplier-declared capability profile (product, manufacturing, factory, rate card). Skill ratings come from the QSL domain.
export type CapabilityProfile = {
  product: { categories: string[]; specification: string; range: string };
  manufacturing: { process: string; capacity: string; machinery: string[] };
  factory: { name: string; location: string; facility: string };
  rateCard: { item: string; unit: string; rate: string }[];
};

export const capabilityProfiles: Record<string, CapabilityProfile> = {
  'SUP-0012': {
    product: { categories: ['Alloy sheets', 'Steel fasteners'], specification: 'EN 10025 structural grades, thickness 0.5-12 mm', range: '120 SKUs across sheet, coil and fastener families' },
    manufacturing: { process: 'Hot rolling, cold rolling, heat treatment', capacity: '4,200 ton / month', machinery: ['4-high rolling mill', 'Continuous annealing line', 'Slitting line'] },
    factory: { name: 'Dusseldorf main plant', location: 'Dusseldorf, Germany', facility: 'ISO 9001 certified, 38,000 m2, on-site laboratory' },
    rateCard: [{ item: 'Standard processing', unit: 'per ton', rate: 'EUR 142' }, { item: 'Expedited processing', unit: 'per ton', rate: 'EUR 168' }],
  },
  'SUP-0034': {
    product: { categories: ['Control boards', 'Sensors'], specification: 'IPC-A-610 Class 2, RoHS compliant', range: '45 board variants, 12 sensor models' },
    manufacturing: { process: 'SMT assembly, reflow soldering, functional test', capacity: '650,000 boards / month', machinery: ['SMT line x4', 'AOI inspection', 'In-circuit tester'] },
    factory: { name: 'Hsinchu electronics plant', location: 'Hsinchu, Taiwan', facility: 'Class 100k clean assembly area, ESD controlled' },
    rateCard: [{ item: 'Board assembly', unit: 'per board', rate: 'USD 3.10' }, { item: 'Functional test', unit: 'per board', rate: 'USD 0.45' }],
  },
  'SUP-0051': {
    product: { categories: ['Packaging film', 'Cartons'], specification: 'Food-contact grade, EU 10/2011', range: '60 film and carton formats' },
    manufacturing: { process: 'Extrusion, printing, converting', capacity: '1,800 ton / month', machinery: ['5-layer extrusion line', '8-colour flexo press', 'Carton folder-gluer'] },
    factory: { name: 'Monterrey converting plant', location: 'Monterrey, Mexico', facility: 'BRCGS Packaging certified, 22,000 m2' },
    rateCard: [{ item: 'Printed film', unit: 'per kg', rate: 'USD 4.80' }, { item: 'Folding carton', unit: 'per 1,000', rate: 'USD 96' }],
  },
  'SUP-0067': {
    product: { categories: ['M8 bolts', 'Bearings'], specification: 'ISO 898-1 property class 8.8-10.9', range: '300 fastener and 80 bearing SKUs' },
    manufacturing: { process: 'Cold heading, thread rolling, heat treatment, plating', capacity: '9 million pieces / month', machinery: ['Cold headers x12', 'Thread rollers x20', 'Continuous furnace'] },
    factory: { name: 'Cleveland plant', location: 'Cleveland, USA', facility: 'IATF 16949 certified, 30,000 m2' },
    rateCard: [{ item: 'Standard bolt M8', unit: 'per 1,000', rate: 'USD 38' }, { item: 'Plated bolt M8', unit: 'per 1,000', rate: 'USD 46' }],
  },
  'SUP-0089': {
    product: { categories: ['Cloud hosting', 'Security support'], specification: 'ISO 27001 aligned operations', range: '3 hosting tiers, 24x7 security monitoring' },
    manufacturing: { process: 'Managed service delivery', capacity: '400 managed workloads', machinery: ['Two Tier-III data centres'] },
    factory: { name: 'Bangkok delivery centre', location: 'Bangkok, Thailand', facility: 'Security operations centre, 24x7' },
    rateCard: [{ item: 'Engineer (senior)', unit: 'per hour', rate: 'USD 42' }, { item: 'Engineer (standard)', unit: 'per hour', rate: 'USD 30' }],
  },
  'SUP-0103': {
    product: { categories: ['Road freight', 'Warehousing'], specification: 'GDP-compliant temperature-controlled transport', range: 'Ambient, chilled and frozen lanes across Thailand and ASEAN' },
    manufacturing: { process: 'Cross-dock, warehousing, last-mile delivery', capacity: '2,400 pallet positions', machinery: ['Reefer fleet x65', 'Automated pallet shuttle'] },
    factory: { name: 'Laem Chabang logistics hub', location: 'Chonburi, Thailand', facility: 'Chilled and frozen storage, 14,000 m2' },
    rateCard: [{ item: 'Pallet storage', unit: 'per pallet / month', rate: 'EUR 11' }, { item: 'Chilled transport', unit: 'per km', rate: 'EUR 1.35' }],
  },
  'SUP-0118': {
    product: { categories: ['Solvents', 'Process additives'], specification: 'Technical grade, REACH registered', range: '28 product lines' },
    manufacturing: { process: 'Batch blending, distillation', capacity: '900 ton / month', machinery: ['Reactor vessels x6', 'Distillation column'] },
    factory: { name: 'Lagos chemical plant', location: 'Lagos, Nigeria', facility: 'Hazardous materials permit, 12,000 m2' },
    rateCard: [{ item: 'Toll blending', unit: 'per ton', rate: 'USD 210' }],
  },
};
