import test from 'node:test';
import assert from 'node:assert/strict';
import { V11_SOURCE_HEADS } from '../src/data/v11SourceHeads.ts';
import { verifyCandidateRows } from '../src/services/sourceCandidateValidator.ts';

const rows = () => V11_SOURCE_HEADS.map(head => ({
  source_head_id: head.id,
  source_map: head.map,
  verification_status: 'UNVERIFIED',
  executable: false,
  raw_original_record: JSON.parse(JSON.stringify(head))
}));

test('live source reference is accepted only when all 170 records exactly match', () => {
  assert.deepEqual(verifyCandidateRows(rows()), V11_SOURCE_HEADS);
});
test('executable or approved candidate is refused even if source labels match', () => {
  const mutated = rows(); mutated[4].executable = true;
  assert.throws(() => verifyCandidateRows(mutated), /integrity failure/);
  const mutated2 = rows(); mutated2[149].verification_status = 'VERIFIED';
  assert.throws(() => verifyCandidateRows(mutated2), /integrity failure/);
});
test('missing, extra, reordered and modified source references fail closed', () => {
  assert.throws(() => verifyCandidateRows(rows().slice(0,169)), /exactly 170/);
  assert.throws(() => verifyCandidateRows([...rows(), ...rows().slice(0,1)]), /exactly 170/);
  const shuffled = rows(); [shuffled[0],shuffled[1]]=[shuffled[1],shuffled[0]];
  assert.throws(() => verifyCandidateRows(shuffled), /integrity failure/);
  const changed = rows(); changed[0].raw_original_record.en='Invented legal name';
  assert.throws(() => verifyCandidateRows(changed), /integrity failure/);
});
test('null or structurally invalid database result is rejected', () => {
  assert.throws(() => verifyCandidateRows(null), /exactly 170/);
  const changed=rows(); changed[0].raw_original_record=null;
  assert.throws(() => verifyCandidateRows(changed), /integrity failure/);
});
