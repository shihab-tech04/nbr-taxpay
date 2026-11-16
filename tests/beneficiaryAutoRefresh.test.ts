import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
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

test('saved picker ignores list and TIN callbacks from a previous owner session', () => {
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  assert.match(picker,/ownerScopeRef\.current=ownerScope/);
  assert.equal((picker.match(/if\(cancelled\|\|ownerScopeRef\.current!==ownerScope\)return;/g)||[]).length,2);
  assert.match(picker,/finally\(\(\)=>\{if\(!cancelled&&ownerScopeRef\.current===ownerScope\)setLoading\(false\);\}\)/);
  assert.match(picker,/onAvailableTins\(Array\.from\(new Set\(result\.people/);
});
