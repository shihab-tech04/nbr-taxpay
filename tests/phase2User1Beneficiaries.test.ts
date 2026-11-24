import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_USERS, type DemoUserId } from '../src/data/demoUsers';
import { sampleTinForUserNumber } from '../src/data/sampleTinSuggestions';
import { BENEFICIARY_RELATIONS, BENEFICIARY_TAGS, validBeneficiaryClassification } from '../src/services/beneficiaryTags';

type Row = {
  recipient_preview_id: string; display_name: string; tin_alias: string;
  tag: string; relationship: string | null; other_label: string | null; list_key: string;
};
type Group = { key: string; display: string; category: string; recipient_numbers: number[] };
type Fixture = {
  scope: string; owner_preview_id: string; owner_real_supabase_auth_id: string | null;
  selection: { seed: string; method: string; seed_hash_unsigned_32: number;
    eligible_profile_numbers: number[]; selected_profile_numbers: number[]; unselected_profile_numbers: number[] };
  groups: Group[]; beneficiaries: Row[];
};
const fixture = JSON.parse(readFileSync(new URL('./fixtures/user1-beneficiary-scenarios-v95.json', import.meta.url), 'utf8')) as Fixture;

function seededSelection(seed: string): { hash: number; shuffled: number[] } {
  // Platform-stable FNV-1a -> Mulberry32 -> Fisher-Yates, never Math.random().
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  let state = hash;
  const random = (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = Array.from({ length: 29 }, (_, index) => index + 2);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return { hash, shuffled };
}

test('Phase 2: exactly 24 of the 29 other profiles are chosen reproducibly', () => {
  const { seed, selected_profile_numbers: selected, unselected_profile_numbers: unselected,
    eligible_profile_numbers: eligible } = fixture.selection;
  assert.equal(seed, 'sohojkor-user1-beneficiaries-phase2-v1');
  assert.deepEqual(eligible, Array.from({ length: 29 }, (_, index) => index + 2));
  const { hash, shuffled } = seededSelection(seed);
  assert.equal(hash, fixture.selection.seed_hash_unsigned_32);
  assert.deepEqual(selected, shuffled.slice(0, 24));
  assert.deepEqual(unselected, shuffled.slice(24).sort((a, b) => a - b));
  assert.equal(selected.length, 24);
  assert.equal(new Set(selected).size, 24);
  assert.ok(selected.every(id => id >= 2 && id <= 30));
  assert.ok(!selected.includes(1));
  assert.equal(unselected.length, 5);
});

test('Phase 2: six private logical lists contain exactly four unique recipients each', () => {
  assert.equal(fixture.scope, 'NONPROD_ISOLATED_ONLY');
  assert.equal(fixture.owner_preview_id, 'user1');
  assert.equal(fixture.owner_real_supabase_auth_id, null);
  assert.equal(fixture.groups.length, 6);
  assert.equal(new Set(fixture.groups.map(group => group.key)).size, 6);
  assert.equal(fixture.beneficiaries.length, 24);
  assert.equal(new Set(fixture.beneficiaries.map(row => row.recipient_preview_id)).size, 24);
  assert.equal(new Set(fixture.beneficiaries.map(row => row.tin_alias)).size, 24);
  const selected = fixture.selection.selected_profile_numbers;
  const groupNumbers = fixture.groups.flatMap(group => group.recipient_numbers);
  assert.deepEqual([...groupNumbers].sort((a, b) => a - b),
    [...selected].sort((a, b) => a - b));
  // Role-aware group assignment prevents fictional companies being labeled as parents.
  const getRole = (number: number) => DEMO_USERS[('user' + number) as DemoUserId].role;
  assert.ok(fixture.groups[0].recipient_numbers.every(number => getRole(number) === 'TAXPAYER_CORPORATE'));
  assert.ok(fixture.groups[1].recipient_numbers.every(number =>
    getRole(number) === 'TAXPAYER_CORPORATE' || getRole(number) === 'WITHHOLDING_AGENT'));
  assert.ok(fixture.groups.slice(2).every(group =>
    group.recipient_numbers.every(number => getRole(number) === 'TAXPAYER_INDIVIDUAL')));
  for (const group of fixture.groups) {
    assert.equal(group.recipient_numbers.length, 4, group.key);
    const people = fixture.beneficiaries.filter(row => row.list_key === group.key);
    assert.equal(people.length, 4, group.key);
    assert.deepEqual(people.map(row => Number(row.recipient_preview_id.slice(4))), group.recipient_numbers);
    for (const person of people) assert.equal(person.tag, group.category);
  }
});

test('Phase 2: every category and family relationship has valid classification', () => {
  const categories = new Set(fixture.beneficiaries.map(row => row.tag));
  const relationships = new Set(fixture.beneficiaries.flatMap(row => row.relationship ? [row.relationship] : []));
  assert.deepEqual([...categories].sort(), [...BENEFICIARY_TAGS].sort());
  assert.deepEqual([...relationships].sort(), [...BENEFICIARY_RELATIONS].sort());
  for (const row of fixture.beneficiaries) {
    assert.equal(validBeneficiaryClassification(row.tag, row.relationship, row.other_label), true,
      row.recipient_preview_id);
    const number = Number(row.recipient_preview_id.slice(4));
    assert.equal(row.tin_alias, sampleTinForUserNumber(number), row.recipient_preview_id);
    assert.equal(row.display_name, DEMO_USERS[row.recipient_preview_id as DemoUserId].nameEn,
      row.recipient_preview_id);
    assert.match(row.tin_alias, /^[0-9]{12}$/);
  }
});
