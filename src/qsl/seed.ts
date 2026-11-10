// MOCK demo data. History is replayed through the real services with a fake clock so every round carries a genuine
// snapshot, answers, ratings, assessment, approval and timeline.
import type { CriteriaData, Level, ScopeType, Snapshot } from './types.ts';
import { staff, supplierActor } from './actors.ts';
import { getStore, resetStore, setClock, supplierCategory } from './store.ts';
import { addCriteriaToForm, activateForm, createCriteria, createCriteriaGroup, createForm } from './services/criteria.ts';
import {
  attachEvidence, completePreReview, createDraft, decide, extendValidity, findQsl, getSnapshot, saveAssessedRatings, recordSample, requestMoreInfo, saveAnswers, saveEvaluations, saveSelfRatings,
  submitAnswers, submitRequest, submitAssessment, suspendQualification,
} from './services/assessments.ts';
import { publishToQsl, withdrawFromQsl } from './services/publishing.ts';
import { submitRateCard, portalCriteria, type RateCardInput } from './services/portal.ts';

let ticks = 0;
function at(date: string): void {
  const base = Date.parse(`${date}T09:00:00Z`);
  ticks = 0;
  setClock(() => new Date(base + (ticks++) * 60_000));
}

const levelText = (name: string): [string, string, string] => [`${name}: basic control in place`, `${name}: controlled and documented`, `${name}: advanced, audited and continuously improved`];

const skills = ['Food safety', 'Quality system', 'Traceability', 'Supply capability'];
const standard: { code: string; name: string; skill: string; description: string; answerType: CriteriaData['answerType']; options?: string[]; unit?: string; evidence: boolean }[] = [
  { code: 'FS-01', name: 'HACCP food safety plan', skill: 'Food safety', description: 'A documented HACCP plan covers all products supplied', answerType: 'Choice', options: ['Yes', 'No'], evidence: true },
  { code: 'FS-02', name: 'Certified food safety standard', skill: 'Food safety', description: 'Which GFSI-recognised standard is certified', answerType: 'Choice', options: ['FSSC 22000', 'BRCGS', 'ISO 22000', 'None'], evidence: true },
  { code: 'FS-03', name: 'Allergen management', skill: 'Food safety', description: 'Describe how allergens are controlled and cross-contact prevented', answerType: 'LongText', evidence: false },
  { code: 'QS-01', name: 'Quality management certificate', skill: 'Quality system', description: 'ISO 9001 or equivalent certificate number', answerType: 'ShortText', evidence: true },
  { code: 'QS-02', name: 'Customer complaint rate', skill: 'Quality system', description: 'Complaints per million units in the last 12 months', answerType: 'Number', unit: 'ppm', evidence: false },
  { code: 'TR-01', name: 'Last mock-recall test', skill: 'Traceability', description: 'Date of the most recent batch traceability test', answerType: 'Date', evidence: false },
  { code: 'TR-02', name: 'Recall procedure', skill: 'Traceability', description: 'Describe the recall procedure and response time', answerType: 'LongText', evidence: true },
  { code: 'SC-01', name: 'Monthly capacity', skill: 'Supply capability', description: 'Maximum monthly supply volume for this category', answerType: 'Number', unit: 'ton', evidence: false },
];

export function seedMasterData(): void {
  const admin = staff.admin;
  at('2026-01-05');
  const groupIds = new Map(skills.map(name => [name, createCriteriaGroup(admin, name).id]));
  const ids = new Map(standard.map(spec => [spec.code, createCriteria(admin, {
    code: spec.code, name: spec.name, groupId: groupIds.get(spec.skill)!, description: spec.description, answerType: spec.answerType, options: spec.options, unit: spec.unit, evidenceRequired: spec.evidence, levels: levelText(spec.name),
  }, 'Standard').id]));
  const form = (code: string, name: string, categories: string[], sections: [string, string[]][]) => {
    const created = createForm(admin, { code, name, categories, sections: sections.map(([title, codes]) => ({ title, items: codes.map(item => ({ criteriaId: ids.get(item)!, required: true })) })) });
    activateForm(admin, created.id);
    return created.id;
  };
  const food = form('FRM-FOOD', 'Food & ingredient supplier form', ['Food', 'Ingredient'], [['Food safety', ['FS-01', 'FS-02', 'FS-03']], ['Quality system', ['QS-01', 'QS-02']], ['Traceability', ['TR-01', 'TR-02']]]);
  form('FRM-RAW', 'Raw material supplier form', ['Raw material'], [['Quality system', ['QS-01', 'QS-02']], ['Traceability', ['TR-01']], ['Supply capability', ['SC-01']]]);
  // A buyer-owned criteria, kept separate from the central standard criteria.
  const custom = createCriteria(staff.coordinator, {
    code: 'BC-01', name: 'Halal certification', groupId: groupIds.get('Food safety')!, description: 'Valid halal certificate for products supplied to this buyer', answerType: 'Choice', options: ['Yes', 'No'], evidenceRequired: true,
    levels: levelText('Halal certification'),
  }, 'BuyerCustom');
  addCriteriaToForm(staff.coordinator, food, custom.id, { section: 'Food safety', required: true });
}

const answerFor = (type: CriteriaData['answerType'], options?: string[]) =>
  type === 'Choice' ? options![0] : type === 'Number' ? 12 : type === 'Date' ? '2026-01-15' : type === 'File' ? 'document.pdf' : type === 'ShortText' ? 'CERT-2026-001' : 'Documented and reviewed procedure';

type Stage = 'draft' | 'submitted' | 'prereview' | 'sample' | 'infoRequested' | 'assessing' | 'approval' | 'approved' | 'rejected';
type Step = {
  supplierId: string; category?: string; stage: Stage; reassess?: string; sampleRequired?: boolean; scope?: [ScopeType, string]; publish?: boolean;
  dates: [request: string, supplier: string, assess: string, decide: string]; due?: string; reason?: string; assessor?: 'assessor' | 'assessor2'; approver?: 'approver' | 'approver2';
};

// What the Supplier Portal would send back: every requested skill offered with two rate lines, and the required documents attached.
function rateCardFor(snapshot: Snapshot, requiredEvidence: { id: string; mandatory: boolean }[], supplierName: string): RateCardInput {
  const criteria = portalCriteria(snapshot);
  const link = (targetId: string, docType: string) => ({ targetId, docId: `DOC-${targetId}`, docName: 'Certificate', docType, version: 1, expiry: '2030-12-31', fileNames: ['certificate.pdf'] });
  return {
    version: 1, submittedBy: `${supplierName} contact`, role: 'Supplier Admin',
    terms: { currency: 'THB', rateBasis: 'Daily', effectiveFrom: '2026-11-01', validUntil: '2027-10-31', leadTimeDays: '14', paymentTermsDays: '45', escalationPct: '3', overtimeWeekday: '1.5', overtimeHoliday: '2', notes: '' },
    skills: Object.fromEntries(criteria.map(item => [item.id, { offered: 'Yes' as const, selfRating: '3', comment: '', lines: [{ level: '2', headcount: '6', avgYears: '4', rate: '1800' }, { level: '3', headcount: '3', avgYears: '8', rate: '2600' }] }])),
    evidence: [...criteria.filter(item => item.evidenceRequired).map(item => link(item.id, 'Quality Certification')), ...requiredEvidence.filter(item => item.mandatory).map(item => link(item.id, 'Quality Certification'))],
    declaration: true,
  };
}

function runRound(step: Step): string {
  const coordinator = staff.coordinator;
  const assessor = staff[step.assessor ?? 'assessor'];
  const approver = staff[step.approver ?? 'approver'];
  const supplier = supplierActor(step.supplierId);
  const category = step.category ?? supplierCategory(step.supplierId) ?? '';
  at(step.dates[0]);
  const formId = getStore().forms.find(item => item.versions[0].data.categories.includes(category))?.id ?? '';
  const [scopeType, scopeDetail] = step.scope ?? ['Site / plant', `${findSupplierName(step.supplierId)} main plant`];
  const draft = createDraft(coordinator, {
    supplierId: step.supplierId, category, formId, assessmentType: step.reassess ? 'Re' : 'First', previousQslId: step.reassess, sampleRequired: step.sampleRequired, scopeType, scopeDetail,
    dueDate: step.due ?? '2026-12-31', assessorId: assessor.id, approverId: approver.id, reason: step.reason ?? 'Annual supplier qualification',
  });
  if (step.stage === 'draft') return draft.id;
  submitRequest(coordinator, draft.id);
  if (step.stage === 'submitted') return draft.id;
  at(step.dates[1]);
  const snapshot = getSnapshot(findQsl(draft.id));
  saveAnswers(supplier, draft.id, snapshot.criteria.filter(item => item.data.answerType !== 'File').map(item => ({ criteriaId: item.id, value: answerFor(item.data.answerType, item.data.options) })));
  snapshot.criteria.filter(item => item.data.evidenceRequired).forEach(item => attachEvidence(supplier, draft.id, item.id, `${item.data.code}-evidence.pdf`));
  saveSelfRatings(supplier, draft.id, snapshot.skills.map(skill => ({ skillId: skill.id, level: 3 })));
  submitRateCard(supplier, draft.id, rateCardFor(snapshot, findQsl(draft.id).portal.requiredEvidence, findSupplierName(step.supplierId)));
  submitAnswers(supplier, draft.id);
  if (step.stage === 'prereview') return draft.id;
  completePreReview(coordinator, draft.id, { infoChecked: true, documentsChecked: true, decision: 'Proceed', comment: 'Company information and documents checked' });
  if (step.stage === 'sample') return draft.id;
  if (step.sampleRequired) recordSample(coordinator, draft.id, { reference: `SR-${draft.id}`, result: 'Pass', comment: 'Sample accepted' });
  at(step.dates[2]);
  if (step.stage === 'infoRequested') {
    saveEvaluations(assessor, draft.id, [{ criteriaId: snapshot.criteria[0].id, verdict: 'NeedsFix', messageToSupplier: 'Please attach the latest audit report' }]);
    requestMoreInfo(assessor, draft.id);
    return draft.id;
  }
  const rated = (index: number): Level => ((index % 3) + 1) as Level;
  saveEvaluations(assessor, draft.id, snapshot.criteria.map(item => ({ criteriaId: item.id, verdict: 'Compliant' as const, comment: 'Evidence reviewed' })));
  saveAssessedRatings(assessor, draft.id, snapshot.skills.map((skill, index) => ({ skillId: skill.id, level: rated(index) })));
  if (step.stage === 'assessing') return draft.id;
  submitAssessment(assessor, draft.id, { recommended: step.stage === 'rejected' ? 'Fail' : 'Pass', summary: step.stage === 'rejected' ? 'Controls are not demonstrated' : 'Controls are in place', internalNote: 'Checked against submitted evidence' });
  if (step.stage === 'approval') return draft.id;
  at(step.dates[3]);
  if (step.stage === 'rejected') decide(approver, draft.id, { decision: 'Reject', reason: 'Critical food safety controls are not demonstrated' });
  else {
    decide(approver, draft.id, { decision: 'Approve', reason: 'Meets the qualification criteria', effectiveDate: step.dates[3] });
    if (step.publish !== false) publishToQsl(approver, draft.id);
  }
  return draft.id;
}

const findSupplierName = (id: string) => ({ 'SUP-0012': 'Dusseldorf', 'SUP-0034': 'Hsinchu', 'SUP-0051': 'Monterrey', 'SUP-0067': 'Cleveland', 'SUP-0089': 'Bangkok', 'SUP-0103': 'Laem Chabang', 'SUP-0118': 'Lagos' }[id] ?? id);

function seedDemoData(): void {
  resetStore();
  seedMasterData();
  const approved = (supplierId: string, dates: Step['dates'], extra: Partial<Step> = {}) => runRound({ supplierId, stage: 'approved', dates, ...extra });
  const primeRaw = approved('SUP-0067', ['2026-02-20', '2026-02-25', '2026-03-05', '2026-03-15']);
  approved('SUP-0103', ['2025-11-10', '2025-11-15', '2025-12-01', '2025-12-10'], { assessor: 'assessor2', approver: 'approver2' });
  const globalFood = approved('SUP-0051', ['2025-08-01', '2025-08-10', '2025-08-25', '2025-09-02']);
  runRound({ supplierId: 'SUP-0118', stage: 'rejected', dates: ['2026-08-10', '2026-08-18', '2026-08-28', '2026-09-03'] });
  const apexIngredient = approved('SUP-0034', ['2025-10-01', '2025-10-10', '2025-10-20', '2025-11-01']);
  const titan = approved('SUP-0012', ['2025-04-01', '2025-04-08', '2025-04-20', '2025-05-02'], { assessor: 'assessor2', approver: 'approver2' });
  const apexRaw = approved('SUP-0034', ['2026-05-10', '2026-05-15', '2026-05-22', '2026-06-01'], { category: 'Raw material', scope: ['Product line', 'Control boards'] });
  // Approved but not yet published: shows as Eligible on the QSL.
  approved('SUP-0103', ['2026-09-20', '2026-09-24', '2026-10-02', '2026-10-12'], { category: 'Ingredient', publish: false, assessor: 'assessor2', approver: 'approver2' });

  // In-flight rounds, one per stage of the flow.
  runRound({ supplierId: 'SUP-0012', stage: 'approval', reassess: titan, dates: ['2026-10-01', '2026-10-05', '2026-10-12', ''], reason: 'Annual requalification cycle', assessor: 'assessor2', approver: 'approver' });
  runRound({ supplierId: 'SUP-0051', stage: 'draft', reassess: globalFood, dates: ['2026-10-18', '', '', ''], reason: 'Qualification result expired' });
  runRound({ supplierId: 'SUP-0089', stage: 'submitted', dates: ['2026-10-01', '', '', ''], due: '2026-10-20', reason: 'New supplier onboarding' });
  runRound({ supplierId: 'SUP-0103', category: 'Raw material', stage: 'prereview', dates: ['2026-10-20', '2026-10-24', '', ''], reason: 'Extension to raw material supply' });
  runRound({ supplierId: 'SUP-0034', category: 'Food', stage: 'assessing', dates: ['2026-10-14', '2026-10-18', '2026-10-22', ''], reason: 'Extension to food products' });
  runRound({ supplierId: 'SUP-0067', category: 'Food', stage: 'assessing', dates: ['2026-10-05', '2026-10-08', '2026-10-15', ''], reason: 'Extension to food products' });
  runRound({ supplierId: 'SUP-0118', category: 'Raw material', stage: 'infoRequested', dates: ['2026-10-06', '2026-10-09', '2026-10-14', ''], reason: 'Extension to raw material supply' });
  runRound({ supplierId: 'SUP-0051', category: 'Ingredient', stage: 'approval', dates: ['2026-10-02', '2026-10-06', '2026-10-13', ''], reason: 'Extension to ingredients' });

  at('2026-10-10');
  suspendQualification(staff.approver, apexRaw, 'Open CAR on a quality defect');
  at('2026-10-12');
  extendValidity(staff.approver, primeRaw, { newExpiry: '2027-05-14', reason: 'Audit planned for Q2 2027' });
  at('2026-10-14');
  withdrawFromQsl(staff.approver, apexIngredient, 'Supplier stopped supplying this category');
  setClock(null);
}

export const ensureDemoData = (): void => {
  const store = getStore();
  if (!store.qsls.length && !store.forms.length) seedDemoData();
};
