// MOCK: company registry data published by the Department of Business Development (DBD). It only exists for Thai juristic entities.
// Replace with the DBD feed once it is connected.
type DbdDirector = { name: string; position: string; authorizedSignatory: boolean };
type DbdFinancial = { year: number; revenue: number; netProfit: number; totalAssets: number; totalLiabilities: number };

export type DbdRecord = {
  juristicId: string;
  registeredOn: string;
  status: 'Active' | 'Liquidating' | 'Dissolved';
  businessType: string;
  registeredCapital: number;
  paidUpCapital: number;
  registeredAddress: string;
  directors: DbdDirector[];
  signingAuthority: string;
  financials: DbdFinancial[];
  updatedOn: string;
};

const M = 1_000_000;
const two = 'Any two authorized directors sign jointly and affix the company seal';
const one = 'Any one authorized director signs and affixes the company seal';

export const dbdRecords: Record<string, DbdRecord> = {
  'SUP-0089': {
    juristicId: '0105567089326', registeredOn: '2023-11-20', status: 'Active', businessType: 'Computer programming and IT consultancy (TSIC 6201)', registeredCapital: 12 * M, paidUpCapital: 6 * M,
    registeredAddress: '7th Floor, Sathorn Tech Tower, 90 Sathon Nuea Road, Bang Rak, Bangkok 10500',
    directors: [{ name: 'Arisa Chantarawong', position: 'Managing Director', authorizedSignatory: true }, { name: 'Kittipong Rattanakul', position: 'Director', authorizedSignatory: false }],
    signingAuthority: one,
    financials: [{ year: 2023, revenue: 18 * M, netProfit: -2.4 * M, totalAssets: 9.6 * M, totalLiabilities: 5.1 * M }],
    updatedOn: '2024-09-06',
  },
  'SUP-0103': {
    juristicId: '0105544103557', registeredOn: '2001-03-19', status: 'Active', businessType: 'Freight transport and warehousing (TSIC 4923)', registeredCapital: 180 * M, paidUpCapital: 180 * M,
    registeredAddress: '99 Moo 5, Laem Chabang Industrial Estate, Si Racha, Chonburi 20230',
    directors: [{ name: 'Prasit Wongchaiyo', position: 'Chief Executive Officer', authorizedSignatory: true }, { name: 'Mali Kaewkamnerd', position: 'Director', authorizedSignatory: true }, { name: 'Surachai Boonmee', position: 'Director', authorizedSignatory: false }],
    signingAuthority: two,
    financials: [
      { year: 2023, revenue: 1340 * M, netProfit: 96 * M, totalAssets: 920 * M, totalLiabilities: 470 * M },
      { year: 2022, revenue: 1260 * M, netProfit: 88 * M, totalAssets: 870 * M, totalLiabilities: 460 * M },
      { year: 2021, revenue: 1150 * M, netProfit: 74 * M, totalAssets: 810 * M, totalLiabilities: 450 * M },
    ],
    updatedOn: '2024-07-30',
  },
  'SUP-0124': {
    juristicId: '0105549124783', registeredOn: '2006-05-30', status: 'Active', businessType: 'Manufacture of fasteners and hardware (TSIC 2599)', registeredCapital: 150 * M, paidUpCapital: 150 * M,
    registeredAddress: '55 Moo 2, Amata Nakorn Industrial Estate, Mueang, Chonburi 20000',
    directors: [{ name: 'Somchai Prasertsuk', position: 'Chairman', authorizedSignatory: true }, { name: 'Nattaya Wongsakul', position: 'Director', authorizedSignatory: true }, { name: 'Pichai Srisawat', position: 'Director', authorizedSignatory: false }],
    signingAuthority: one,
    financials: [
      { year: 2023, revenue: 980 * M, netProfit: 118 * M, totalAssets: 760 * M, totalLiabilities: 310 * M },
      { year: 2022, revenue: 905 * M, netProfit: 104 * M, totalAssets: 700 * M, totalLiabilities: 300 * M },
      { year: 2021, revenue: 820 * M, netProfit: 91 * M, totalAssets: 640 * M, totalLiabilities: 295 * M },
    ],
    updatedOn: '2024-08-20',
  },
  'SUP-0139': {
    juristicId: '0105547139662', registeredOn: '2004-10-07', status: 'Active', businessType: 'Manufacture of plastic packaging (TSIC 2222)', registeredCapital: 120 * M, paidUpCapital: 120 * M,
    registeredAddress: '120 Moo 6, Bangpoo Industrial Estate, Samut Prakan 10280',
    directors: [{ name: 'Wichai Chaiyaporn', position: 'Chairman', authorizedSignatory: true }, { name: 'Suda Thongchai', position: 'Director', authorizedSignatory: true }, { name: 'Anan Sirisuk', position: 'Director', authorizedSignatory: false }],
    signingAuthority: two,
    financials: [
      { year: 2023, revenue: 870 * M, netProfit: 61 * M, totalAssets: 690 * M, totalLiabilities: 380 * M },
      { year: 2022, revenue: 830 * M, netProfit: 66 * M, totalAssets: 650 * M, totalLiabilities: 350 * M },
      { year: 2021, revenue: 760 * M, netProfit: 52 * M, totalAssets: 600 * M, totalLiabilities: 340 * M },
    ],
    updatedOn: '2024-08-10',
  },
  'SUP-0142': {
    juristicId: '0105541142108', registeredOn: '1998-08-14', status: 'Active', businessType: 'Manufacture of basic iron and steel (TSIC 2410)', registeredCapital: 200 * M, paidUpCapital: 200 * M,
    registeredAddress: '77 Moo 8, Map Ta Phut Industrial Estate, Mueang, Rayong 21150',
    directors: [{ name: 'Thanakorn Vongvanich', position: 'Chairman', authorizedSignatory: true }, { name: 'Orawan Phetcharat', position: 'Director', authorizedSignatory: true }],
    signingAuthority: two,
    financials: [
      { year: 2023, revenue: 720 * M, netProfit: -64 * M, totalAssets: 610 * M, totalLiabilities: 560 * M },
      { year: 2022, revenue: 860 * M, netProfit: -18 * M, totalAssets: 650 * M, totalLiabilities: 540 * M },
      { year: 2021, revenue: 1010 * M, netProfit: 47 * M, totalAssets: 690 * M, totalLiabilities: 520 * M },
    ],
    updatedOn: '2024-07-12',
  },
};

export const dbdSource = 'DBD (Department of Business Development)';

// The DBD only covers companies registered in Thailand; foreign suppliers show N/A in the DBD section.
export const hasDbd = (supplier: { country: string }) => supplier.country === 'Thailand';
