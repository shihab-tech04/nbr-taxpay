import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createBeneficiaryAutoRefreshGate} from '../src/services/beneficiaryAutoRefresh';

test('focus plus visibility resume shares one beneficiary read', () => {
  const gate = createBeneficiaryAutoRefreshGate(1250);
  assert.equal(gate.begin(1000), true);
  assert.equal(gate.begin(1001), false, 'Do not duplicate an in-flight read');
  gate.finish();
  assert.equal(gate.begin(1010), false, 'Do not repeat immediate focus/visibility events');
  assert.equal(gate.begin(2250), true, 'Allow a subsequent genuine focus refresh');
  gate.finish();
});

test('failed reads release the guard without treating stale data as current', () => {
  const gate = createBeneficiaryAutoRefreshGate(100);
  assert.equal(gate.begin(0), true);
  gate.finish();
  assert.equal(gate.begin(100), true);
  gate.finish();
  assert.equal(gate.begin(Number.NaN), false);
});
