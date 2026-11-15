import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProductionCutoverSafe,
  ORIGINAL_TAXPAYER,
  PRIMARY_V2_CANDIDATE,
  SEPARATE_OFFICE
} from './sohojkor-v2-cutover-gate.mjs';

const baseline = {originalUrl: ORIGINAL_TAXPAYER, officeUrl: SEPARATE_OFFICE};

test('approved existing original-source deployment remains possible', () => {
  assert.deepEqual(assertProductionCutoverSafe({...baseline,primaryUrl: ORIGINAL_TAXPAYER}),
    {status:'ORIGINAL_PRIMARY_UNCHANGED'});
});

test('new V2 project cannot replace primary until independent hosted gates pass', () => {
  assert.throws(
    () => assertProductionCutoverSafe({...baseline,primaryUrl:PRIMARY_V2_CANDIDATE}),
    /BLOCKED V2 production cutover/
  );
});

test('a variable claiming approval cannot bypass missing hosted evidence', () => {
  assert.throws(
    () => assertProductionCutoverSafe({...baseline,primaryUrl:PRIMARY_V2_CANDIDATE,approved:true}),
    /not verified/
  );
});

test('the original Taxpayer project may not be silently replaced as fallback', () => {
  assert.throws(
    () => assertProductionCutoverSafe({primaryUrl:PRIMARY_V2_CANDIDATE,originalUrl:PRIMARY_V2_CANDIDATE,officeUrl:SEPARATE_OFFICE}),
    /Legacy source changed/
  );
});

test('Office remains a separate authorized database and Auth project', () => {
  assert.throws(
    () => assertProductionCutoverSafe({...baseline,officeUrl:ORIGINAL_TAXPAYER,primaryUrl:PRIMARY_V2_CANDIDATE}),
    /Office project identity changed/
  );
});

test('unknown database endpoints fail closed and are never treated as V2', () => {
  assert.throws(
    () => assertProductionCutoverSafe({...baseline,primaryUrl:'https://unknown.supabase.co'}),
    /Unrecognized/
  );
});
