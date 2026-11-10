export type OrgRelation = 'Ultimate parent' | 'Subsidiary' | 'Affiliate' | 'Plant / branch';
export type OrgEngagement = 'Contracting' | 'Supplying' | 'Invoicing';
export type OrgSource = 'D&B family tree' | 'ERP vendor master' | 'Supplier declared' | 'Manual entry';

export type OrgNode = {
  id: string;
  name: string;
  relation: OrgRelation;
  country: string;
  focus: string;
  ownership?: number;
  engagement: OrgEngagement[];
  supplierId?: string;
  source: OrgSource;
  verified: boolean;
  current?: boolean;
  children?: OrgNode[];
};

export const engagementLabel: Record<OrgEngagement, string> = {
  Contracting: 'Contracting entity',
  Supplying: 'Supplying site',
  Invoicing: 'Invoicing entity',
};

// Keyed by the SLM supplier ID of the company we deal with.
export const orgStructures: Record<string, OrgNode> = {
  'SUP-0012': {
    id: 'titan-holding', name: 'Titan Holding GmbH', relation: 'Ultimate parent', country: 'Germany', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'titan-industries', name: 'Titan Industries Ltd', relation: 'Subsidiary', country: 'Germany', focus: 'Alloy sheets · Steel fasteners', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0012', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'titan-dusseldorf', name: 'Düsseldorf plant', relation: 'Plant / branch', country: 'Germany', focus: 'Alloy sheet rolling', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
          { id: 'titan-polska', name: 'Titan Fasteners Polska', relation: 'Subsidiary', country: 'Poland', focus: 'Steel fastener manufacturing', ownership: 100, engagement: ['Supplying'], source: 'Supplier declared', verified: false },
        ],
      },
      { id: 'titan-logistics', name: 'Titan Logistics BV', relation: 'Affiliate', country: 'Netherlands', focus: 'Freight & warehousing', ownership: 40, engagement: [], source: 'D&B family tree', verified: true },
    ],
  },
  'SUP-0034': {
    id: 'apex-holdings', name: 'Apex Holdings Ltd', relation: 'Ultimate parent', country: 'Taiwan', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'apex-components', name: 'Apex Components Inc', relation: 'Subsidiary', country: 'Taiwan', focus: 'Control boards · Sensors', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0034', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'apex-hsinchu', name: 'Hsinchu plant', relation: 'Plant / branch', country: 'Taiwan', focus: 'Board assembly', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'apex-shenzhen', name: 'Apex Components Shenzhen', relation: 'Subsidiary', country: 'China', focus: 'Sensor manufacturing', ownership: 100, engagement: ['Supplying'], source: 'Supplier declared', verified: false },
    ],
  },
  'SUP-0051': {
    id: 'globaltech-group', name: 'GlobalTech Group SA', relation: 'Ultimate parent', country: 'Mexico', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'globaltech-mfg', name: 'GlobalTech Manufacturing', relation: 'Subsidiary', country: 'Mexico', focus: 'Packaging film · Cartons', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0051', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'globaltech-monterrey', name: 'Monterrey plant', relation: 'Plant / branch', country: 'Mexico', focus: 'Carton converting', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'globaltech-texas', name: 'GlobalTech Packaging Texas', relation: 'Subsidiary', country: 'USA', focus: 'Packaging film', ownership: 100, engagement: ['Supplying'], source: 'Supplier declared', verified: false },
    ],
  },
  'SUP-0067': {
    id: 'primeparts-holdings', name: 'PrimeParts Holdings Inc', relation: 'Ultimate parent', country: 'USA', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'primeparts-co', name: 'PrimeParts Co.', relation: 'Subsidiary', country: 'USA', focus: 'M8 bolts · Bearings', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0067', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'primeparts-ohio', name: 'Ohio plant', relation: 'Plant / branch', country: 'USA', focus: 'Fastener machining', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
    ],
  },
  'SUP-0118': {
    id: 'okoye-group', name: 'Okoye Industrial Group', relation: 'Ultimate parent', country: 'Nigeria', focus: 'Group holding', engagement: [], source: 'Manual entry', verified: false,
    children: [
      {
        id: 'chemcore-solutions', name: 'Chemcore Solutions', relation: 'Subsidiary', country: 'Nigeria', focus: 'Solvents · Process additives', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0118', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'chemcore-lagos', name: 'Lagos plant', relation: 'Plant / branch', country: 'Nigeria', focus: 'Solvent blending', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'chemcore-logistics', name: 'Chemcore Logistics', relation: 'Affiliate', country: 'Nigeria', focus: 'Hazmat transport', ownership: 35, engagement: ['Supplying'], source: 'Manual entry', verified: false },
    ],
  },
  'SUP-0089': {
    id: 'vertex-group', name: 'Vertex Group Co., Ltd.', relation: 'Ultimate parent', country: 'Thailand', focus: 'Group holding', engagement: [], source: 'Supplier declared', verified: false,
    children: [
      {
        id: 'vertex-systems', name: 'Vertex Systems Co., Ltd.', relation: 'Subsidiary', country: 'Thailand', focus: 'Cloud hosting · Security support', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0089', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'vertex-bangkok', name: 'Bangkok delivery centre', relation: 'Plant / branch', country: 'Thailand', focus: 'Managed cloud operations', engagement: ['Supplying'], source: 'Supplier declared', verified: false },
        ],
      },
    ],
  },
  'SUP-0103': {
    id: 'nordex-holding', name: 'Nordex Holding Co., Ltd.', relation: 'Ultimate parent', country: 'Thailand', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'nordex-logistics', name: 'Nordex Logistics Co., Ltd.', relation: 'Subsidiary', country: 'Thailand', focus: 'Road freight · Warehousing', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0103', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'nordex-laemchabang', name: 'Laem Chabang hub', relation: 'Plant / branch', country: 'Thailand', focus: 'Port warehousing', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'nordex-cold-chain', name: 'Nordex Cold Chain Co., Ltd.', relation: 'Affiliate', country: 'Thailand', focus: 'Temperature-controlled transport', ownership: 45, engagement: ['Supplying'], source: 'Supplier declared', verified: false },
    ],
  },
  'SUP-0124': {
    id: 'fastener-world-holding', name: 'Fastener World Holding Co., Ltd.', relation: 'Ultimate parent', country: 'Thailand', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'fastener-world', name: 'Fastener World Co., Ltd.', relation: 'Subsidiary', country: 'Thailand', focus: 'Industrial screws · Nuts', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0124', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'fastener-amata', name: 'Amata Nakorn plant', relation: 'Plant / branch', country: 'Thailand', focus: 'Cold forging', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'fastener-vietnam', name: 'Fastener World Vietnam', relation: 'Subsidiary', country: 'Vietnam', focus: 'Nut manufacturing', ownership: 100, engagement: ['Supplying'], source: 'Supplier declared', verified: false },
    ],
  },
  'SUP-0139': {
    id: 'bluesky-holding', name: 'BlueSky Holding Co., Ltd.', relation: 'Ultimate parent', country: 'Thailand', focus: 'Group holding', engagement: [], source: 'D&B family tree', verified: true,
    children: [
      {
        id: 'bluesky-plastics', name: 'BlueSky Plastics Co., Ltd.', relation: 'Subsidiary', country: 'Thailand', focus: 'PET resin · Plastic containers', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0139', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'bluesky-bangpoo', name: 'Bangpoo plant', relation: 'Plant / branch', country: 'Thailand', focus: 'Container moulding', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
    ],
  },
  'SUP-0142': {
    id: 'steelforce-group', name: 'SteelForce Group Co., Ltd.', relation: 'Ultimate parent', country: 'Thailand', focus: 'Group holding', engagement: [], source: 'Manual entry', verified: false,
    children: [
      {
        id: 'steelforce-europe', name: 'SteelForce Europe Co., Ltd.', relation: 'Subsidiary', country: 'Thailand', focus: 'Steel coils · Metal sheets', ownership: 100, engagement: ['Contracting', 'Supplying', 'Invoicing'], supplierId: 'SUP-0142', current: true, source: 'ERP vendor master', verified: true,
        children: [
          { id: 'steelforce-maptaphut', name: 'Map Ta Phut mill', relation: 'Plant / branch', country: 'Thailand', focus: 'Coil rolling', engagement: ['Supplying'], source: 'ERP vendor master', verified: true },
        ],
      },
      { id: 'steelforce-trading', name: 'SteelForce Trading Co., Ltd.', relation: 'Affiliate', country: 'Thailand', focus: 'Steel distribution', ownership: 30, engagement: ['Invoicing'], source: 'Manual entry', verified: false },
    ],
  },
};

export function flattenOrg(node: OrgNode): OrgNode[] {
  return [node, ...(node.children ?? []).flatMap(flattenOrg)];
}
