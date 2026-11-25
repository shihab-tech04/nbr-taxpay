import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USERS, DEMO_USER_IDS } from '../src/data/demoUsers';
import { MASTER_PAYMENT_HEADS } from '../src/data/paymentHeads';
import { TAXPAYER_PROFILE_FIELD_ORDER } from '../src/contracts/taxpayerProfileFieldLayout';
import { BENEFICIARY_TAGS, BENEFICIARY_RELATIONS } from '../src/services/beneficiaryTags';

/**
 * F-011/F-019/F-032-F-039/F-071-F-073/F-138/F-166/F-177/F-178
 * Source-derived acceptance matrix only. No database writes, real e-TIN claims,
 * authenticated accounts, tax credit, government challans or payment settlement.
 * Real SQL -> Office parity must be separately confirmed on authorized data.
 */
const FIXTURE_SCOPE = 'NONPROD_ISOLATED_ONLY';
const TIN_YEARS = ['2024-25', '2025-26', '2026-27'] as const;
const groupKeys = [
  'clients_one', 'clients_two', 'family_one', 'family_two', 'others_one', 'others_two',
] as const;
const groupTags = [
  'clients', 'clients', 'friends_family', 'friends_family', 'others', 'others',
] as const;
const relations = [
  'father', 'mother', 'siblings', 'son', 'daughter', 'spouse', 'friends', 'friends',
] as const;
type User = (typeof DEMO_USERS)[keyof typeof DEMO_USERS];
type Category = (typeof MASTER_PAYMENT_HEADS)[number]['category'];
type Line = {
  allocationId: string;
  recipientId: string;
  recipientTin: string;
  headId: number | null;
  category: Category | 'TRAVEL_TAX';
  assessmentYear: string;
  amountMinor: number;
};
type Scenario = {
  parentId: string;
  payerId: 'user1';
  scenarioKind: 'SINGLE_HEAD' | 'COMBINED' | 'PAY_AGAIN' | 'TRAVEL_ONLY';
  fixtureScope: typeof FIXTURE_SCOPE;
  sourcePaymentId: string | null;
  remarks: string;
  lines: Line[];
  totalMinor: number;
};

function seededShuffle<T>(input: readonly T[], initialSeed: number): T[] {
  const result = [...input];
  let seed = initialSeed >>> 0;
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const index = seed % (i + 1);
    [result[i], result[index]] = [result[index], result[i]];
  }
  return result;
}
function createScenario(parentId: string, scenarioKind: Scenario['scenarioKind'],
  lines: Line[], remarks = '', sourcePaymentId: string | null = null): Scenario {
  return {
    parentId, scenarioKind, payerId: 'user1', fixtureScope: FIXTURE_SCOPE,
    sourcePaymentId, remarks, lines,
    totalMinor: lines.reduce((sum, line) => sum + line.amountMinor, 0),
  };
}

const users: User[] = DEMO_USER_IDS.map(id => DEMO_USERS[id]);
const profileFields = TAXPAYER_PROFILE_FIELD_ORDER.map(([field]) => field);
const profiles = users.map(user => ({
  accountId: user.id,
  fixtureScope: FIXTURE_SCOPE,
  fields: Object.fromEntries(profileFields.map(key => [key,
    key === 'tin' ? user.tin : key === 'taxpayerName' ? user.nameEn :
    key === 'taxesCircle' ? user.taxCircle : null])),
}));
const selectedBeneficiaries = seededShuffle(
  users.filter(user => user.id !== 'user1'), 20261115,
).slice(0, 24);
const beneficiaries = selectedBeneficiaries.map((user, index) => ({
  id: `qa-v953-beneficiary-${index + 1}`,
  ownerId: 'user1' as const,
  recipientId: user.id,
  recipientTin: user.tin,
  recipientName: user.nameEn,
  listKey: groupKeys[Math.floor(index / 4)],
  tag: groupTags[Math.floor(index / 4)],
  relationship: index >= 8 && index < 16 ? relations[index - 8] : null,
  otherLabel: index >= 16 ? `Isolated contact ${index - 15}` : null,
}));

const activeCandidateHeads = MASTER_PAYMENT_HEADS.filter(head => head.status === 'ACTIVE');
const nonReturnCategories = [
  'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
  'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT',
] as const;
const nonReturnHeads = nonReturnCategories.map(category => {
  const head = activeCandidateHeads.find(candidate => candidate.category === category);
  assert.ok(head, `Expected candidate head for ${category}`);
  return head;
});
const singleHeadScenarios: Scenario[] = activeCandidateHeads.flatMap(head =>
  [0, 1].map(variant => {
    const recipient = variant === 0 ? users[0] : selectedBeneficiaries[(head.id + variant) % 24];
    const parentId = `qa-v953-head-${head.id}-${variant + 1}`;
    return createScenario(parentId, 'SINGLE_HEAD', [{
      allocationId: `${parentId}-allocation-1`, recipientId: recipient.id,
      recipientTin: recipient.tin, category: head.category, headId: head.id,
      assessmentYear: TIN_YEARS[(head.id + variant) % 3],
      amountMinor: 10000 + head.id * 100 + variant * 25,
    }]);
  }),
);
const combinedScenarios: Scenario[] = beneficiaries.map((beneficiary, index) => {
  const parentId = `qa-v953-combined-${index + 1}`;
  const recipients = [users[0], DEMO_USERS[beneficiary.recipientId as keyof typeof DEMO_USERS],
    DEMO_USERS[beneficiaries[(index + 1) % 24].recipientId as keyof typeof DEMO_USERS]];
  const lines: Line[] = recipients.map((recipient, lineIndex) => {
    const head = nonReturnHeads[(index + lineIndex) % nonReturnHeads.length];
    return {
      allocationId: `${parentId}-allocation-${lineIndex + 1}`,
      recipientId: recipient.id, recipientTin: recipient.tin,
      category: head.category, headId: head.id,
      assessmentYear: TIN_YEARS[(index + lineIndex) % 3],
      amountMinor: 2500 + index * 100 + lineIndex * 25,
    };
  });
  return createScenario(parentId, 'COMBINED', lines,
    'বাংলা ও English — combined challan remarks longer than twenty characters.\nSecond line.');
});
const sourceToRepeat = combinedScenarios[0];
const repeat = createScenario('qa-v953-pay-again-1', 'PAY_AGAIN',
  sourceToRepeat.lines.map((line, index) => ({
    ...line, allocationId: `qa-v953-pay-again-1-allocation-${index + 1}`,
  })), 'Editable Pay Again remarks\nআগের মন্তব্য পরিবর্তনযোগ্য', sourceToRepeat.parentId);
const travelScenarios = [0, 1].map(index => {
  const parentId = `qa-v953-travel-${index + 1}`;
  return createScenario(parentId, 'TRAVEL_ONLY', [{
    allocationId: `${parentId}-traveller-1`, recipientId: users[index].id,
    recipientTin: users[index].tin, headId: null, category: 'TRAVEL_TAX',
    assessmentYear: TIN_YEARS[2], amountMinor: 10000 + index * 1000,
  }]);
});
const scenarios = [...singleHeadScenarios, ...combinedScenarios, repeat, ...travelScenarios];

test('v9.5.3 QA: 30 existing fictional identities share exactly the approved 24-field profile shape', () => {
  assert.equal(users.length, 30);
  assert.equal(new Set(users.map(user => user.tin)).size, 30);
  assert.equal(profileFields.length, 24);
  assert.equal(new Set(profileFields).size, 24);
  assert.equal(profiles.length, 30);
  for (const row of profiles) {
    assert.equal(row.fixtureScope, FIXTURE_SCOPE);
    assert.deepEqual(Object.keys(row.fields), profileFields);
    assert.ok(row.fields.tin);
    assert.ok(row.fields.taxpayerName);
  }
});

test('v9.5.3 QA: seeded User1 selection has 24 unique recipients, six 4-person lists, every tag and family relation', () => {
  assert.equal(beneficiaries.length, 24);
  assert.equal(new Set(beneficiaries.map(row => row.recipientId)).size, 24);
  assert.ok(beneficiaries.every(row => row.ownerId === 'user1' && row.recipientId !== 'user1'));
  assert.deepEqual([...new Set(beneficiaries.map(row => row.listKey))], [...groupKeys]);
  for (const key of groupKeys) assert.equal(beneficiaries.filter(row => row.listKey === key).length, 4);
  assert.deepEqual(new Set(beneficiaries.map(row => row.tag)), new Set(BENEFICIARY_TAGS));
  assert.deepEqual(new Set(beneficiaries.map(row => row.relationship).filter(Boolean)), new Set(BENEFICIARY_RELATIONS));
  assert.ok(beneficiaries.filter(row => row.tag === 'others').every(row => row.otherLabel && row.otherLabel.length <= 80));
});

test('v9.5.3 QA: two isolated single-head cases per active catalogue candidate; blocked heads never appear', () => {
  assert.equal(MASTER_PAYMENT_HEADS.length, 170);
  assert.deepEqual(MASTER_PAYMENT_HEADS.filter(head => head.status === 'BLOCKED').map(head => head.id), [5, 150]);
  assert.equal(activeCandidateHeads.length, 168);
  assert.equal(singleHeadScenarios.length, 336);
  for (const head of activeCandidateHeads) {
    const covered = singleHeadScenarios.filter(row => row.lines[0].headId === head.id);
    assert.equal(covered.length, 2, `Uncovered candidate head ${head.id}`);
    assert.ok(covered.every(row => row.lines.length === 1 && row.lines[0].category === head.category));
  }
});

test('v9.5.3 QA: mixed payment parents preserve self, other taxpayers, distinct allocations, years and sums', () => {
  assert.equal(combinedScenarios.length, 24);
  assert.ok(combinedScenarios.every(row => row.lines.length === 3));
  for (const scenario of scenarios) {
    assert.equal(scenario.fixtureScope, FIXTURE_SCOPE);
    assert.equal(scenario.totalMinor, scenario.lines.reduce((sum, line) => sum + line.amountMinor, 0));
    assert.ok(scenario.lines.every(line => Number.isSafeInteger(line.amountMinor) && line.amountMinor > 0));
    assert.equal(new Set(scenario.lines.map(line => line.allocationId)).size, scenario.lines.length);
    if (scenario.lines.some(line => line.category === 'TAX_WITH_RETURN')) {
      assert.equal(scenario.lines.length, 1, 'Tax with Return cannot combine heads, years or beneficiaries');
    }
    if (scenario.scenarioKind === 'COMBINED') {
      assert.ok(scenario.lines.some(line => line.recipientId === 'user1'));
      assert.ok(scenario.lines.some(line => line.recipientId !== 'user1'));
      assert.equal(new Set(scenario.lines.map(line => line.assessmentYear)).size, 3);
      assert.ok(scenario.remarks.length > 20 && scenario.remarks.includes('\n'));
    }
    if (scenario.scenarioKind === 'TRAVEL_ONLY') {
      assert.equal(scenario.lines.length, 1);
      assert.equal(scenario.lines[0].category, 'TRAVEL_TAX');
    }
  }
  assert.equal(new Set(scenarios.map(row => row.parentId)).size, scenarios.length);
});

test('v9.5.3 QA: Pay Again carries exact separate source lineage without reusing original allocation IDs', () => {
  assert.equal(repeat.sourcePaymentId, sourceToRepeat.parentId);
  assert.notEqual(repeat.parentId, sourceToRepeat.parentId);
  assert.equal(repeat.totalMinor, sourceToRepeat.totalMinor);
  assert.deepEqual(repeat.lines.map(line => [line.recipientId, line.recipientTin, line.category, line.headId,
    line.assessmentYear, line.amountMinor]), sourceToRepeat.lines.map(line => [line.recipientId,
    line.recipientTin, line.category, line.headId, line.assessmentYear, line.amountMinor]));
  assert.ok(repeat.lines.every((line, i) => line.allocationId !== sourceToRepeat.lines[i].allocationId));
  assert.notEqual(repeat.remarks, sourceToRepeat.remarks);
});