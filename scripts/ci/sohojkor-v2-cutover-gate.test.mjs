import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProductionCutoverSafe, ORIGINAL_TAXPAYER, PRIMARY_V2_CANDIDATE,
  SEPARATE_OFFICE, SIMULATION_SCOPE,
} from './sohojkor-v2-cutover-gate.mjs';

const baseline = {originalUrl: ORIGINAL_TAXPAYER, officeUrl: SEPARATE_OFFICE};

test('preserve existing Original primary configuration', () => {
  assert.deepEqual(assertProductionCutoverSafe({...baseline, primaryUrl: ORIGINAL_TAXPAYER}),
    {status:'ORIGINAL_PRIMARY_UNCHANGED'});
});
test('reject V2 without reviewed fictional-simulation scope', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline, primaryUrl: PRIMARY_V2_CANDIDATE}),
    /only reviewed fictional simulation scope/);
});
test('do not accept an approval=true flag without the correct scope', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, approved: true}),
  /only reviewed fictional simulation scope/);
});
test('scoped V2 candidate must still pass actual hosted smoke at deployment', () => {
  assert.deepEqual(assertProductionCutoverSafe({...baseline,
    primaryUrl: PRIMARY_V2_CANDIDATE, releaseScope: SIMULATION_SCOPE}),
    {status:'V2_SIMULATION_HOSTED_SMOKE_REQUIRED'});
});
test('do not overwrite the separately identified Original database', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    originalUrl: PRIMARY_V2_CANDIDATE, primaryUrl: PRIMARY_V2_CANDIDATE,
    releaseScope: SIMULATION_SCOPE}), /Legacy source changed/);
});
test('Office must remain an independent SQL and Auth identity', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    officeUrl: ORIGINAL_TAXPAYER, primaryUrl: PRIMARY_V2_CANDIDATE,
    releaseScope: SIMULATION_SCOPE}), /Office identity changed/);
});
test('unknown backend endpoints fail closed', () => {
  assert.throws(() => assertProductionCutoverSafe({...baseline,
    primaryUrl:'https://unknown.supabase.co', releaseScope: SIMULATION_SCOPE}),
    /Unrecognized/);
});
