import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { buildSync } from 'esbuild';

const ws1Root = process.env.WS1_SOURCE_DIR;
const ws1Sha = process.env.WS1_SOURCE_SHA;
const outputPath = process.env.WS3_F137_MATRIX_FIXTURE_OUT;
assert.ok(ws1Root && ws1Sha && outputPath, 'Current Work A #779 source, SHA, and matrix fixture output are required');

const sourceFile = (path) => resolve(ws1Root, path);
const entry = [
  'import { prepareCombinedOtherTaxPayment } from ' + JSON.stringify(sourceFile('src/services/otherTaxCombinedPayment.ts')) + ';',
  'import { V11_SOURCE_HEADS, isV11HeadReviewBlocked } from ' + JSON.stringify(sourceFile('src/data/v11SourceHeads.ts')) + ';',
  'import { V11_PAYMENT_OPTIONS } from ' + JSON.stringify(sourceFile('src/data/v11PaymentOptions.ts')) + ';',
  'import { BLOCKED_HEAD_IDS } from ' + JSON.stringify(sourceFile('src/data/paymentHeads.ts')) + ';',
  'export { prepareCombinedOtherTaxPayment, V11_SOURCE_HEADS, isV11HeadReviewBlocked, V11_PAYMENT_OPTIONS, BLOCKED_HEAD_IDS };',
].join('\n');
const bundled = buildSync({
  stdin: { contents: entry, resolveDir: ws1Root, sourcefile: 'ws5-f137-current-work-a.ts' },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
});
const moduleRecord = { exports: {} };
vm.runInNewContext(bundled.outputFiles[0].text, {
  module: moduleRecord,
  exports: moduleRecord.exports,
  require: createRequire(import.meta.url),
  Buffer,
  process,
  console,
  setTimeout,
  clearTimeout,
}, { timeout: 15000 });
const { prepareCombinedOtherTaxPayment, V11_SOURCE_HEADS, isV11HeadReviewBlocked, V11_PAYMENT_OPTIONS, BLOCKED_HEAD_IDS } = moduleRecord.exports;
assert.equal(typeof prepareCombinedOtherTaxPayment, 'function');
assert.ok(Array.isArray(V11_SOURCE_HEADS) && Array.isArray(V11_PAYMENT_OPTIONS));

const options = new Map(V11_PAYMENT_OPTIONS.map((head) => [head.id, head]));
const eligible = V11_SOURCE_HEADS.filter((head) =>
  head.active &&
  (head.journey === 'LIABILITY' || head.journey === 'WITHHOLDING') &&
  head.purpose !== 'return' &&
  head.map === 'MAPPED' &&
  !isV11HeadReviewBlocked(head) &&
  !BLOCKED_HEAD_IDS.includes(head.id) &&
  options.get(head.id)?.status === 'ACTIVE'
);
const eligibleIds = eligible.map((head) => head.id);
assert.ok(eligible.length > 0);
assert.equal(new Set(eligibleIds).size, eligibleIds.length, 'Mapped eligible head IDs must be unique');
const eligibleSet = new Set(eligibleIds);
const rejectedHeads = V11_SOURCE_HEADS.filter((head) =>
  head.active &&
  (head.journey === 'LIABILITY' || head.journey === 'WITHHOLDING') &&
  !eligibleSet.has(head.id)
);
const returnHeadIds = new Set(rejectedHeads.filter((head) => head.purpose === 'return').map((head) => head.id));
assert.ok(rejectedHeads.some((head) => head.purpose === 'return'), 'The current mapped Return head must be in the exclusion matrix');
const years = ['2027-28', '2026-27', '2025-26', '2024-25'];
const amountsMinor = 100;
const makeLine = (head, tin, name, year, sourceId) => {
  const option = options.get(head.id);
  assert.ok(option, 'Every current source head must resolve through V11_PAYMENT_OPTIONS');
  return {
    sourceId,
    taxpayerTin: tin,
    taxpayerName: name,
    assessmentYear: year,
    amountMinor: amountsMinor,
    line: {
      headId: head.id,
      serviceCode: option.category,
      isWithholding: option.isWithholding,
      economicCode: option.economicCode,
      headNameEn: head.en,
      taxAmount: 1,
      penaltyAmount: 0,
      surchargeAmount: 0,
      interestAmount: 0,
      totalAmount: 1,
    },
  };
};
const makeValidLines = (tins) => {
  const lines = Array.from(eligible, (head, index) =>
    makeLine(head, tins[index % tins.length].tin, tins[index % tins.length].name,
      years[index % years.length], 'f137-valid-' + head.id));
  const repeatedHead = eligible[0];
  const firstTin = tins[0];
  // Existing rules allow the same head for the same taxpayer in another AY,
  // and for a second taxpayer in the same AY, with separate allocation IDs.
  lines.push(makeLine(repeatedHead, firstTin.tin, firstTin.name, years[1], 'f137-repeat-year-' + repeatedHead.id));
  if (tins.length > 1) {
    lines.push(makeLine(repeatedHead, tins[1].tin, tins[1].name, years[0], 'f137-repeat-beneficiary-' + repeatedHead.id));
  }
  return lines;
};
const makeReceipt = (mode, lines, key) => {
  const totalMinor = lines.reduce((sum, item) => sum + item.amountMinor, 0);
  return {
    id: 'f137-receipt-' + key,
    challanNo: 'SIM-' + key,
    tokenNumber: 'SIM-TOKEN-' + key,
    paymentCategory: 'OTHER_TAX_PAYMENT',
    assessmentYear: 'Multiple years',
    payerName: 'WS3 matrix payer',
    payerTin: '111111111111',
    taxpayerTin: lines[0]?.taxpayerTin,
    receiptMobile: '01712345678',
    isRepresentativePayment: mode === 'OTHER',
    isWithholding: false,
    items: lines.map((item) => item.line),
    totalAmount: totalMinor / 100,
    paymentMethod: 'BKASH',
    gatewayTransactionId: 'SIM-TXN-' + key,
    treasuryStatus: 'INITIATED',
    taxCreditStatus: 'PENDING_RECONCILIATION',
    createdAt: '2026-11-14 12:00:00',
    isSimulatedDemo: true,
  };
};
const makeOriginal = (mode, lines, key) => ({
  idempotencyKey: key,
  sessionId: randomUUID(),
  service: 'OTHER_TAX_PAYMENT',
  amountMinor: lines.reduce((sum, item) => sum + item.amountMinor, 0),
  details: {
    payerId: 'user1',
    payerName: 'WS3 matrix payer',
    payerTin: '111111111111',
    payerMode: mode,
    taxpayerTin: lines[0]?.taxpayerTin,
    assessmentYear: lines[0]?.assessmentYear,
    receiptReference: 'SIM-' + key,
  },
});
const normalized = (value) => JSON.parse(JSON.stringify(value));
const validModes = [
  { mode: 'OTHER', tins: [
    { tin: '222222222222', name: 'WS3 matrix recipient 2' },
    { tin: '333333333333', name: 'WS3 matrix recipient 3' },
  ] },
  { mode: 'SELF', tins: [
    { tin: '111111111111', name: 'WS3 matrix payer' },
    { tin: '222222222222', name: 'WS3 matrix recipient 2' },
    { tin: '333333333333', name: 'WS3 matrix recipient 3' },
  ] },
];
let validPayload = null;
const validSummaries = [];
for (const { mode, tins } of validModes) {
  const lines = makeValidLines(tins);
  const key = randomUUID();
  const receipt = makeReceipt(mode, lines, key);
  const prepared = normalized(prepareCombinedOtherTaxPayment(makeOriginal(mode, lines, key), receipt, lines));
  const allocations = prepared.payload.details.allocations;
  assert.equal(prepared.payload.service, 'OTHER_TAX_PAYMENT');
  assert.equal(prepared.payload.details.payerMode, mode);
  assert.equal(prepared.payload.details.allocationContractVersion, 3);
  assert.equal(prepared.payload.details.allocationCount, lines.length);
  assert.equal(prepared.payload.details.taxpayerCount, tins.length);
  assert.equal(new Set(allocations.map((item) => item.headId)).size, eligible.length);
  assert.deepEqual(new Set(allocations.map((item) => item.assessmentYear)).size, years.length);
  assert.equal(allocations.reduce((sum, item) => sum + item.amountMinor, 0), prepared.payload.amountMinor);
  assert.deepEqual(allocations.map((item) => item.allocationId), lines.map((item) => item.sourceId));
  assert.deepEqual(allocations.map((item) => item.assessmentYear), lines.map((item) => item.assessmentYear));
  assert.deepEqual(allocations.map((item) => item.amountMinor), lines.map((item) => item.amountMinor));
  assert.deepEqual(allocations.map((item) => item.serviceCode),
    lines.map((item) => options.get(item.line.headId).category));
  assert.deepEqual(allocations.map((item) => item.isWithholding),
    lines.map((item) => options.get(item.line.headId).isWithholding));
  assert.equal(prepared.payload.details.receiptSnapshot.items.length, lines.length);
  assert.equal(prepared.payload.details.receiptReference, 'SIM-' + key);
  validSummaries.push({ payerMode: mode, allocationCount: lines.length, amountMinor: prepared.payload.amountMinor });
  if (mode === 'OTHER') validPayload = prepared.payload;
}
assert.ok(validPayload, 'One valid OTHER payload is required for the paired SQL/API path');

const rejectedIdempotencyKeys = [];
let rejectedCases = 0;
let returnSameYear = 0;
let returnDifferentYear = 0;
let blockedReviewPairs = 0;
const assertRejected = (mode, lines, suffix) => {
  const key = randomUUID();
  const receipt = makeReceipt(mode, lines, key);
  const original = makeOriginal(mode, lines, key);
  assert.throws(
    () => prepareCombinedOtherTaxPayment(original, receipt, lines),
    (error) => error?.message === 'INVALID_COMBINED_HEAD',
    'Excluded mapped head must be rejected before a SQL request is constructed'
  );
  rejectedIdempotencyKeys.push(key);
  rejectedCases++;
  const returnLine = lines.find((line) => returnHeadIds.has(line.line.headId));
  if (returnLine) {
    if (new Set(lines.map((line) => line.assessmentYear)).size > 1) returnDifferentYear++;
    else returnSameYear++;
  } else {
    blockedReviewPairs++;
  }
};
const otherModeTin = { tin: '222222222222', name: 'WS3 matrix recipient 2' };
const selfModeTin = { tin: '111111111111', name: 'WS3 matrix payer' };
for (const { mode } of validModes) {
  const tin = mode === 'SELF' ? selfModeTin : otherModeTin;
  const name = mode === 'SELF' ? 'WS3 matrix payer' : 'WS3 matrix recipient 2';
  for (const invalid of rejectedHeads) {
    const option = options.get(invalid.id);
    assert.ok(option, 'Rejected mapped head must still have a source payment option');
    for (let partnerIndex = 0; partnerIndex < eligible.length; partnerIndex++) {
      const partner = eligible[partnerIndex];
      const validYearIndex = partnerIndex % years.length;
      const validYear = years[validYearIndex];
      const invalidYear = invalid.purpose === 'return' && partnerIndex % 2 === 0
        ? years[(validYearIndex + 1) % years.length]
        : validYear;
      const lines = [
        makeLine(partner, tin.tin, name, validYear, 'f137-rejected-valid-' + rejectedCases),
        makeLine(invalid, tin.tin, name, invalidYear, 'f137-rejected-excluded-' + rejectedCases),
      ];
      assertRejected(mode, lines, 'pair');
    }
    const line = makeLine(invalid, tin.tin, name, years[0], 'f137-rejected-pure-' + rejectedCases);
    assertRejected(mode, [line], 'pure');
  }
  const returnHead = rejectedHeads.find((head) => head.purpose === 'return');
  if (returnHead) {
    const firstReturn = makeLine(returnHead, tin.tin, name, years[0], 'f137-return-year-a-' + rejectedCases);
    const nextYearReturn = makeLine(returnHead, tin.tin, name, years[1], 'f137-return-year-b-' + rejectedCases);
    assertRejected(mode, [firstReturn, nextYearReturn], 'return-multiple-years');
  }
}
const expectedPairCases = rejectedHeads.length * eligible.length * validModes.length;
const expectedPureCases = rejectedHeads.length * validModes.length;
const expectedReturnYearCases = returnHeadIds.size * validModes.length;
assert.equal(rejectedCases, expectedPairCases + expectedPureCases + expectedReturnYearCases);
assert.ok(returnSameYear > 0 && returnDifferentYear > 0, 'Return exclusions must cover same-year and cross-year combinations');
assert.ok(blockedReviewPairs > 0, 'Owner-review heads must remain excluded from the composer');
const fixture = {
  sourceSha: ws1Sha,
  eligibleHeadIds: eligibleIds,
  eligibleHeadServices: Object.fromEntries(eligible.map((head) => [head.id, options.get(head.id).category])),
  excludedHeadIds: rejectedHeads.map((head) => head.id),
  validSummaries,
  validAllocationCount: validPayload.details.allocations.length,
  validPayload,
  rejectedIdempotencyKeys,
  rejectedCases,
  returnSameYear,
  returnDifferentYear,
  blockedReviewPairs,
  mappedHeadCount: V11_SOURCE_HEADS.length,
  validCategoryCount: new Set(eligible.map((head) => options.get(head.id).category)).size,
};
writeFileSync(outputPath, JSON.stringify(fixture), { mode: 0o600 });
console.log('PASS F-137-T01 current #779 composer contract at ' + ws1Sha + ': ' +
  eligible.length + ' active mapped non-Return heads [' + eligibleIds.join(',') + '], excluded heads [' +
  rejectedHeads.map((head) => head.id).join(',') + '], service categories [' +
  [...new Set(eligible.map((head) => options.get(head.id).category))].sort().join(',') + ']; ' +
  validSummaries.length + ' payer-mode combinations; ' + rejectedCases + ' rejected cases (' +
  returnSameYear + ' same-year and ' + returnDifferentYear + ' cross-year Return combinations; ' +
  blockedReviewPairs + ' owner-review-head combinations), before any API request; paired SQL/API fixture written');
