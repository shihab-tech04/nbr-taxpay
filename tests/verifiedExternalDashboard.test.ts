import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowVerifiedExternalDashboardRow, currentVerifiedExternalDashboard, type VerifiedExternalDashboardState} from '../src/services/verifiedExternalDashboard';

const full:VerifiedExternalDashboardState={
  ownerUid:'owner-1', assessmentYear:'2026-2027',
  assessment:{status:'success',recordCount:1},
  postedCredits:{status:'success',recordCount:2}
};

test('current application never renders official first row without integrated external records',()=>{
  assert.equal(currentVerifiedExternalDashboard(),null);
  assert.equal(canShowVerifiedExternalDashboardRow(currentVerifiedExternalDashboard(),'owner-1','2026-2027'),false);
});

test('both independently successful external responses are required',()=>{
  assert.equal(canShowVerifiedExternalDashboardRow(full,'owner-1','2026-2027'),true);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,assessment:{status:'error',recordCount:1}},'owner-1','2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,postedCredits:{status:'empty',recordCount:0}},'owner-1','2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,postedCredits:{status:'error',recordCount:2}},'owner-1','2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,assessment:{status:'success',recordCount:0}},'owner-1','2026-2027'),false);
});

test('financial row is always scoped to the exact owner and assessment year',()=>{
  assert.equal(canShowVerifiedExternalDashboardRow(full,null,'2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow(full,'other-user','2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow(full,'owner-1','2025-2026'),false);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,postedCredits:{status:'success',recordCount:NaN}},'owner-1','2026-2027'),false);
  assert.equal(canShowVerifiedExternalDashboardRow({...full,assessment:{status:'success',recordCount:-1}},'owner-1','2026-2027'),false);
});
