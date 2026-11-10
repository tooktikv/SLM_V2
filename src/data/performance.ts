export type PerfScores = { score: number; delivery: number; quality: number; cost: number; resp: number };
type ProductPerformance = PerfScores & { name: string };
export type SupplierPerformance = PerfScores & { name: string; category: string; products: ProductPerformance[] };

// Product scores average to the supplier score, so both views stay consistent.
export const performanceSuppliers: SupplierPerformance[] = [
  { name: 'PrimeParts Co.', category: 'Mechanical', score: 94, delivery: 96, quality: 93, cost: 91, resp: 95, products: [
    { name: 'M8 bolts', score: 96, delivery: 97, quality: 96, cost: 92, resp: 95 },
    { name: 'Bearings', score: 92, delivery: 95, quality: 90, cost: 90, resp: 95 },
  ]},
  { name: 'Nordex Logistics', category: 'Logistics', score: 88, delivery: 91, quality: 87, cost: 84, resp: 90, products: [
    { name: 'Road freight', score: 91, delivery: 93, quality: 90, cost: 86, resp: 91 },
    { name: 'Warehousing', score: 85, delivery: 89, quality: 84, cost: 82, resp: 89 },
  ]},
  { name: 'Fastener World', category: 'Mechanical', score: 94, delivery: 95, quality: 96, cost: 92, resp: 94, products: [
    { name: 'Industrial screws', score: 95, delivery: 96, quality: 97, cost: 93, resp: 95 },
    { name: 'Nuts', score: 93, delivery: 94, quality: 95, cost: 91, resp: 93 },
  ]},
  { name: 'BlueSky Plastics', category: 'Packaging', score: 77, delivery: 79, quality: 76, cost: 74, resp: 80, products: [
    { name: 'PET resin', score: 80, delivery: 82, quality: 79, cost: 76, resp: 81 },
    { name: 'Plastic containers', score: 74, delivery: 76, quality: 73, cost: 72, resp: 79 },
  ]},
  { name: 'Apex Components', category: 'Electronics', score: 81, delivery: 83, quality: 80, cost: 79, resp: 82, products: [
    { name: 'Control boards', score: 84, delivery: 86, quality: 82, cost: 81, resp: 84 },
    { name: 'Sensors', score: 78, delivery: 80, quality: 78, cost: 77, resp: 80 },
  ]},
  { name: 'GlobalTech Mfg', category: 'Packaging', score: 74, delivery: 71, quality: 76, cost: 73, resp: 77, products: [
    { name: 'Packaging film', score: 79, delivery: 76, quality: 80, cost: 77, resp: 80 },
    { name: 'Cartons', score: 69, delivery: 66, quality: 72, cost: 69, resp: 74 },
  ]},
  { name: 'Chemcore Solutions', category: 'Chemicals', score: 58, delivery: 61, quality: 54, cost: 56, resp: 60, products: [
    { name: 'Solvents', score: 52, delivery: 55, quality: 47, cost: 50, resp: 56 },
    { name: 'Process additives', score: 64, delivery: 67, quality: 61, cost: 62, resp: 64 },
  ]},
  { name: 'Titan Industries', category: 'Raw Materials', score: 62, delivery: 58, quality: 65, cost: 60, resp: 64, products: [
    { name: 'Alloy sheets', score: 68, delivery: 64, quality: 70, cost: 65, resp: 68 },
    { name: 'Steel fasteners', score: 56, delivery: 52, quality: 60, cost: 55, resp: 60 },
  ]},
];

export const productCategories = ['Raw Materials', 'Electronics', 'Packaging', 'Mechanical', 'Chemicals', 'Logistics'];

export const ALL_CATEGORIES = 'All categories';

const kpiDefs = [
  { label: 'Delivery', target: 90 },
  { label: 'Quality', target: 85 },
  { label: 'Cost', target: 80 },
  { label: 'Responsiveness', target: 85 },
  { label: 'Service', target: 85 },
  { label: 'Compliance', target: 90 },
];

const portfolioScores = [82, 79, 71, 85];

// Service and compliance are not part of the supplier benchmark, so they are kept per scope.
const scopeExtras: Record<string, { service: number; compliance: number; deltas: number[]; trend: number[]; mix: [number, number, number] }> = {
  [ALL_CATEGORIES]: { service: 88, compliance: 74, deltas: [2, -1, 4, 0, 3, -3], trend: [72, 74, 71, 76, 75, 78], mix: [62, 28, 10] },
  'Raw Materials': { service: 72, compliance: 70, deltas: [-4, -2, 1, -1, 0, -5], trend: [66, 65, 63, 64, 61, 62], mix: [10, 45, 45] },
  Electronics: { service: 85, compliance: 76, deltas: [1, 0, 2, 1, 2, -2], trend: [78, 79, 80, 79, 80, 81], mix: [55, 35, 10] },
  Packaging: { service: 80, compliance: 84, deltas: [1, -1, 2, 0, 1, 0], trend: [73, 74, 72, 75, 75, 76], mix: [40, 50, 10] },
  Mechanical: { service: 93, compliance: 96, deltas: [1, 1, 0, 1, 2, 1], trend: [90, 91, 92, 92, 93, 94], mix: [90, 10, 0] },
  Chemicals: { service: 66, compliance: 52, deltas: [-3, -5, -1, -2, -1, -6], trend: [64, 62, 61, 60, 59, 58], mix: [0, 30, 70] },
  Logistics: { service: 92, compliance: 89, deltas: [1, 0, 2, 1, 2, 1], trend: [84, 85, 86, 86, 87, 88], mix: [70, 30, 0] },
};

export function scopeView(category: string) {
  const extras = scopeExtras[category] ?? scopeExtras[ALL_CATEGORIES];
  const summary = category === ALL_CATEGORIES ? null : categorySummary(category);
  const dimensions = summary ? [summary.delivery, summary.quality, summary.cost, summary.resp] : portfolioScores;
  const scores = [...dimensions, extras.service, extras.compliance];
  const kpis = kpiDefs.map((def, index) => ({ ...def, score: scores[index], delta: extras.deltas[index] }));
  const overall = Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;
  return { kpis, overall, trend: extras.trend, mix: extras.mix };
}

const average = (rows: PerfScores[], key: keyof PerfScores) => Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);

export function categorySummary(category: string) {
  const rows = performanceSuppliers.filter(supplier => supplier.category === category);
  const trend = scopeExtras[category].trend;
  return {
    category,
    suppliers: rows.length,
    products: rows.reduce((sum, row) => sum + row.products.length, 0),
    score: average(rows, 'score'),
    delivery: average(rows, 'delivery'),
    quality: average(rows, 'quality'),
    cost: average(rows, 'cost'),
    resp: average(rows, 'resp'),
    trendDelta: trend[trend.length - 1] - trend[0],
  };
}
