import { describe, expect, it } from 'vitest';
import { DEMO_USER_IDS, DEMO_USERS, getDemoUser } from '../src/data/demoUsers';
import { simulationUsers } from '../src/contracts/paymentSimulationContract';
import { demoUserIds } from '../src/data/demoPaymentTransactions';

describe('30 fictional payment profile coverage', () => {
 it('provides exactly thirty consistently named profiles across the app and the SQL simulation contract', () => {
  expect(DEMO_USER_IDS).toHaveLength(30);
  expect(simulationUsers).toEqual(DEMO_USER_IDS);
  expect(demoUserIds).toEqual(DEMO_USER_IDS);
  expect(new Set(DEMO_USER_IDS)).toHaveProperty('size',30);
 });
 it('preserves all original profiles and gives each additional preview a distinct, sample-only 13-digit TIN', () => {
  const ids=DEMO_USER_IDS.map(id=>getDemoUser(id));
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids.map(p=>p?.tin)).size).toBe(30);
  for(const p of ids){expect(p?.tin).toMatch(/^\\d{13}$/);}
  expect(DEMO_USERS.user1.nameEn).toBe('Md. Arif Rahman');
  expect(DEMO_USERS.user30.id).toBe('user30');
 });
 it('rejects preview account IDs outside the approved 1–30 range', () => {
  expect(getDemoUser('user0')).toBeNull();
  expect(getDemoUser('user31')).toBeNull();
  expect(getDemoUser('admin')).toBeNull();
 });
});
