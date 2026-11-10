import type { Tone } from '../components/ui';

// MOCK: supplier stakeholders and commercial terms. Shared by Contacts & Relationship and the Supplier 360 Contacts tab.
export type ContactType = 'Primary' | 'Quality' | 'Operations' | 'Finance' | 'Executive sponsor' | 'Technical' | 'Compliance';

export type Contact = { name: string; title: string; department: string; email: string; phone: string; type: ContactType; products: string; region: string };

export type SupplierProfile = { contacts: Contact[]; paymentTerms: string; leadTime: string; moq: string };

export const supplierProfiles: Record<string, SupplierProfile> = {
  'SUP-0012': {
    contacts: [
      { name: 'Klaus Richter', title: 'Account Director', department: 'Commercial', email: 'klaus.richter@supplier.example', phone: '+49 211 555 0142', type: 'Primary', products: 'Alloy sheets, Steel fasteners', region: 'Europe · Industrial Materials' },
      { name: 'Elisa Braun', title: 'Quality Director', department: 'Quality', email: 'quality@supplier.example', phone: '+49 211 555 0178', type: 'Quality', products: 'Alloy sheets', region: 'Düsseldorf plant' },
      { name: 'Franz Müller', title: 'Logistics Lead', department: 'Operations', email: 'operations@supplier.example', phone: '+49 211 555 0199', type: 'Operations', products: 'Steel fasteners', region: 'Europe distribution' },
    ],
    paymentTerms: 'Net 60', leadTime: '6 weeks', moq: '5 t per order',
  },
  'SUP-0034': {
    contacts: [
      { name: 'Lin Wei', title: 'Commercial Manager', department: 'Commercial', email: 'lin.wei@supplier.example', phone: '+886 3 555 0121', type: 'Primary', products: 'Control boards, Sensors', region: 'APAC · Control Systems' },
      { name: 'Hsu Mei', title: 'Engineering Manager', department: 'Engineering', email: 'engineering@supplier.example', phone: '+886 3 555 0134', type: 'Technical', products: 'Control boards', region: 'Hsinchu plant' },
      { name: 'Chen Yu-Ting', title: 'Finance Controller', department: 'Finance', email: 'finance@supplier.example', phone: '+886 3 555 0160', type: 'Finance', products: 'All products', region: 'Taiwan head office' },
    ],
    paymentTerms: 'Net 45', leadTime: '8 weeks', moq: '1,000 units',
  },
  'SUP-0051': {
    contacts: [
      { name: 'Maria Santos', title: 'Key Account Manager', department: 'Sales', email: 'maria.santos@supplier.example', phone: '+52 81 5550 0113', type: 'Primary', products: 'Packaging film, Cartons', region: 'Americas · Consumer Products' },
      { name: 'Jorge Ramírez', title: 'Plant Manager', department: 'Operations', email: 'operations@supplier.example', phone: '+52 81 5550 0140', type: 'Operations', products: 'Cartons', region: 'Monterrey plant' },
      { name: 'Ana Flores', title: 'Finance Manager', department: 'Finance', email: 'finance@supplier.example', phone: '+52 81 5550 0155', type: 'Finance', products: 'All products', region: 'Mexico head office' },
      { name: 'Carlos Vega', title: 'Managing Director', department: 'Executive', email: 'carlos.vega@supplier.example', phone: '+52 81 5550 0101', type: 'Executive sponsor', products: 'All products', region: 'Americas' },
    ],
    paymentTerms: 'Net 30', leadTime: '4 weeks', moq: '10,000 units',
  },
  'SUP-0067': {
    contacts: [
      { name: 'Daniel Brooks', title: 'Sales Director', department: 'Sales', email: 'daniel.brooks@supplier.example', phone: '+1 614 555 0127', type: 'Primary', products: 'M8 bolts, Bearings', region: 'Americas · Industrial Components' },
      { name: 'Susan Miller', title: 'Quality Manager', department: 'Quality', email: 'quality@supplier.example', phone: '+1 614 555 0166', type: 'Quality', products: 'M8 bolts', region: 'Ohio plant' },
      { name: 'Tom Reyes', title: 'Finance Manager', department: 'Finance', email: 'finance@supplier.example', phone: '+1 614 555 0172', type: 'Finance', products: 'All products', region: 'USA head office' },
      { name: 'Robert Hale', title: 'VP Operations', department: 'Executive', email: 'robert.hale@supplier.example', phone: '+1 614 555 0109', type: 'Executive sponsor', products: 'All products', region: 'Americas' },
    ],
    paymentTerms: 'Net 45', leadTime: '3 weeks', moq: '5,000 pcs',
  },
  'SUP-0118': {
    contacts: [
      { name: 'Adaeze Obi', title: 'Managing Director', department: 'Executive', email: 'adaeze.obi@supplier.example', phone: '+234 1 555 0181', type: 'Primary', products: 'Industrial solvents, Coatings', region: 'Africa · Lagos plant' },
      { name: 'Emeka Nwosu', title: 'EHS Manager', department: 'EHS', email: 'ehs@supplier.example', phone: '+234 1 555 0195', type: 'Compliance', products: 'All products', region: 'Lagos plant' },
    ],
    paymentTerms: 'Net 30', leadTime: '10 weeks', moq: '2 t per batch',
  },
  'SUP-0089': {
    contacts: [
      { name: 'Arisa Chantarawong', title: 'Managing Director', department: 'Executive', email: 'arisa.c@supplier.example', phone: '+66 2 555 0189', type: 'Primary', products: 'Cloud hosting, Security support', region: 'Thailand · Enterprise IT' },
      { name: 'Kittipong Rattanakul', title: 'Head of Security Operations', department: 'Technical', email: 'security@supplier.example', phone: '+66 2 555 0196', type: 'Technical', products: 'Security support', region: 'Bangkok delivery centre' },
    ],
    paymentTerms: 'Net 30', leadTime: '2 weeks', moq: 'Monthly subscription',
  },
  'SUP-0103': {
    contacts: [
      { name: 'Prasit Wongchaiyo', title: 'Chief Executive Officer', department: 'Executive', email: 'prasit.w@supplier.example', phone: '+66 38 555 0103', type: 'Executive sponsor', products: 'All services', region: 'Thailand · Global Logistics' },
      { name: 'Mali Kaewkamnerd', title: 'Key Account Manager', department: 'Sales', email: 'mali.k@supplier.example', phone: '+66 38 555 0114', type: 'Primary', products: 'Road freight, Warehousing', region: 'Laem Chabang hub' },
      { name: 'Surachai Boonmee', title: 'Operations Manager', department: 'Operations', email: 'operations@supplier.example', phone: '+66 38 555 0127', type: 'Operations', products: 'Warehousing', region: 'Laem Chabang hub' },
      { name: 'Ratana Phumiphat', title: 'Finance Manager', department: 'Finance', email: 'finance@supplier.example', phone: '+66 38 555 0131', type: 'Finance', products: 'All services', region: 'Thailand head office' },
    ],
    paymentTerms: 'Net 30', leadTime: '1 week', moq: '1 pallet',
  },
  'SUP-0124': {
    contacts: [
      { name: 'Nattaya Wongsakul', title: 'Sales Director', department: 'Sales', email: 'nattaya.w@supplier.example', phone: '+66 38 555 0124', type: 'Primary', products: 'Industrial screws, Nuts', region: 'Thailand · Industrial Components' },
      { name: 'Pichai Srisawat', title: 'Quality Manager', department: 'Quality', email: 'quality@supplier.example', phone: '+66 38 555 0138', type: 'Quality', products: 'Industrial screws', region: 'Amata Nakorn plant' },
      { name: 'Somchai Prasertsuk', title: 'Chairman', department: 'Executive', email: 'somchai.p@supplier.example', phone: '+66 38 555 0101', type: 'Executive sponsor', products: 'All products', region: 'Thailand' },
      { name: 'Jiraporn Lertsiri', title: 'Finance Manager', department: 'Finance', email: 'finance@supplier.example', phone: '+66 38 555 0150', type: 'Finance', products: 'All products', region: 'Thailand head office' },
    ],
    paymentTerms: 'Net 45', leadTime: '3 weeks', moq: '10,000 pcs',
  },
  'SUP-0139': {
    contacts: [
      { name: 'Suda Thongchai', title: 'Commercial Manager', department: 'Sales', email: 'suda.t@supplier.example', phone: '+66 2 555 0139', type: 'Primary', products: 'PET resin, Plastic containers', region: 'Thailand · Consumer Products' },
      { name: 'Anan Sirisuk', title: 'Plant Manager', department: 'Operations', email: 'operations@supplier.example', phone: '+66 2 555 0147', type: 'Operations', products: 'Plastic containers', region: 'Bangpoo plant' },
      { name: 'Wichai Chaiyaporn', title: 'Chairman', department: 'Executive', email: 'wichai.c@supplier.example', phone: '+66 2 555 0102', type: 'Executive sponsor', products: 'All products', region: 'Thailand' },
    ],
    paymentTerms: 'Net 45', leadTime: '4 weeks', moq: '5 t per order',
  },
  'SUP-0142': {
    contacts: [
      { name: 'Thanakorn Vongvanich', title: 'Chairman', department: 'Executive', email: 'thanakorn.v@supplier.example', phone: '+66 38 555 0142', type: 'Primary', products: 'Steel coils, Metal sheets', region: 'Thailand · Industrial Materials' },
      { name: 'Orawan Phetcharat', title: 'Finance Director', department: 'Finance', email: 'finance@supplier.example', phone: '+66 38 555 0156', type: 'Finance', products: 'All products', region: 'Map Ta Phut plant' },
    ],
    paymentTerms: 'Net 30', leadTime: '8 weeks', moq: '20 t per order',
  },
};

export const contactTone: Record<ContactType, Tone> = { Primary: 'brand', Quality: 'info', Technical: 'info', Compliance: 'info', Operations: 'neutral', Finance: 'success', 'Executive sponsor': 'warning' };
const requiredContactTypes: ContactType[] = ['Executive sponsor', 'Finance'];
export const coverageGaps = (contacts: Contact[]) => requiredContactTypes.filter(type => !contacts.some(contact => contact.type === type));
