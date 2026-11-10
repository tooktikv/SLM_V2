// MOCK: general company information for every supplier. For Thai companies it comes from the DBD registry;
// for foreign companies the source is the supplier's own declaration through the Supplier Portal (no registry is connected yet).
export type CompanyProfile = {
  registrationNumber: string;
  registry: string;
  founded: number;
  employees: number;
  annualRevenue: string;
  website: string;
  registeredAddress: string;
  source: string;
};

const declared = 'Supplier-declared via Supplier Portal';

export const companyProfiles: Record<string, CompanyProfile> = {
  'SUP-0012': { registrationNumber: 'HRB 48213', registry: 'Handelsregister Düsseldorf', founded: 1987, employees: 2400, annualRevenue: '€340M (FY 2023)', website: 'www.titan-industries.example', registeredAddress: 'Industriestrasse 42, 40210 Düsseldorf, Germany', source: declared },
  'SUP-0034': { registrationNumber: '53810427', registry: 'MOEA Business Registry (Unified Business No.)', founded: 2008, employees: 1150, annualRevenue: 'US$82M (FY 2023)', website: 'www.apex-components.example', registeredAddress: 'No. 18 Science Park Road, Hsinchu 30078, Taiwan', source: declared },
  'SUP-0051': { registrationNumber: 'GTM850621-9K2', registry: 'Registro Público de Comercio (RFC)', founded: 2003, employees: 3200, annualRevenue: 'US$96M (FY 2023)', website: 'www.globaltech-mfg.example', registeredAddress: 'Av. Industrial 1200, Monterrey 64000, Mexico', source: declared },
  'SUP-0067': { registrationNumber: 'EIN 84-2710365', registry: 'Ohio Secretary of State', founded: 1996, employees: 780, annualRevenue: 'US$48M (FY 2023)', website: 'www.primeparts.example', registeredAddress: '4500 Industrial Parkway, Columbus, OH 43228, USA', source: declared },
  'SUP-0089': { registrationNumber: '0105567089326', registry: 'DBD juristic ID', founded: 2023, employees: 45, annualRevenue: '฿18M (FY 2023)', website: 'www.vertex-systems.example', registeredAddress: '7th Floor, Sathorn Tech Tower, 90 Sathon Nuea Road, Bang Rak, Bangkok 10500', source: 'DBD (Department of Business Development)' },
  'SUP-0103': { registrationNumber: '0105544103557', registry: 'DBD juristic ID', founded: 2001, employees: 640, annualRevenue: '฿1,340M (FY 2023)', website: 'www.nordex-logistics.example', registeredAddress: '99 Moo 5, Laem Chabang Industrial Estate, Si Racha, Chonburi 20230', source: 'DBD (Department of Business Development)' },
  'SUP-0118': { registrationNumber: 'RC 1842065', registry: 'Corporate Affairs Commission (RC)', founded: 2009, employees: 310, annualRevenue: 'US$18M (FY 2023)', website: 'www.chemcore-solutions.example', registeredAddress: 'Plot 14 Industrial Estate, Ikeja, Lagos, Nigeria', source: declared },
  'SUP-0124': { registrationNumber: '0105549124783', registry: 'DBD juristic ID', founded: 2006, employees: 920, annualRevenue: '฿980M (FY 2023)', website: 'www.fastener-world.example', registeredAddress: '55 Moo 2, Amata Nakorn Industrial Estate, Mueang, Chonburi 20000', source: 'DBD (Department of Business Development)' },
  'SUP-0139': { registrationNumber: '0105547139662', registry: 'DBD juristic ID', founded: 2004, employees: 540, annualRevenue: '฿870M (FY 2023)', website: 'www.bluesky-plastics.example', registeredAddress: '120 Moo 6, Bangpoo Industrial Estate, Samut Prakan 10280', source: 'DBD (Department of Business Development)' },
  'SUP-0142': { registrationNumber: '0105541142108', registry: 'DBD juristic ID', founded: 1998, employees: 700, annualRevenue: '฿720M (FY 2023)', website: 'www.steelforce.example', registeredAddress: '77 Moo 8, Map Ta Phut Industrial Estate, Mueang, Rayong 21150', source: 'DBD (Department of Business Development)' },
};
