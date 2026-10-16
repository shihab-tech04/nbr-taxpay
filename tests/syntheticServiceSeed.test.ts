import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {DEMO_USERS, type DemoUserId} from '../src/data/demoUsers';

const sql = readFileSync(new URL('../supabase/migrations/20261016202514_synthetic_taxpayer_profiles_and_service_records.sql', import.meta.url), 'utf8');
const profileRows = [...sql.matchAll(/^\s*\('(user(?:10|[1-9]))','(TAXPAYER_INDIVIDUAL|TAXPAYER_CORPORATE|WITHHOLDING_AGENT)','[^']+','[^']+','[^']+','[^']+','DEMO-TIN-\d{3}','circle-\d+'\)/gm)];
const serviceRows = [...sql.matchAll(/^\s*\('SAMPLE-SRV-(\d{3})','(user(?:10|[1-9]))','([A-Z_]+)',(null|'20\d{2}-\d{2}'),(\d+),'([A-Z_]+)','(PAYER|BENEFICIARY)',(null|'user(?:10|[1-9])'),'([\dT:\-]+Z)'\)/gm)];

test('all ten preview personas have independently populated SQL profiles with matching roles', () => {
  assert.equal(profileRows.length, 10);
  assert.equal(new Set(profileRows.map(row => row[1])).size, 10);
  for (const row of profileRows) {
    assert.equal(DEMO_USERS[row[1] as DemoUserId].role, row[2]);
  }
});

test('the SQL examples cover all eight services and each user without duplicate seed references', () => {
  const expected = [
    'TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
    'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT', 'TRAVEL_TAX'
  ];
  assert.equal(serviceRows.length, 31);
  assert.equal(new Set(serviceRows.map(row => row[1])).size, 31);
  assert.deepEqual([...new Set(serviceRows.map(row => row[3]))].sort(), expected.sort());
  assert.deepEqual([...new Set(serviceRows.map(row => row[2]))].sort(), Object.keys(DEMO_USERS).sort());
  for (const row of serviceRows) {
    assert.ok(Number(row[5]) > 0);
    assert.equal(row[4] === 'null', row[3] === 'TRAVEL_TAX');
    assert.equal(row[8] !== 'null', row[7] === 'BENEFICIARY');
  }
});

test('sample-service SQL is RLS-protected, publicly read-only and not a financial ledger', () => {
  assert.match(sql, /alter table public\.sim_tax_service_records enable row level security/i);
  assert.match(sql, /grant select on public\.sim_tax_service_records to anon,authenticated/i);
  assert.match(sql, /revoke all on public\.sim_tax_service_records from public,anon,authenticated/i);
  assert.match(sql, /simulation_only boolean not null default true check \(simulation_only\)/i);
  assert.doesNotMatch(sql, /insert into public\.(?:taxpay_payment_requests|taxpay_payment_drafts|sim_payment_allocations)/i);
});
