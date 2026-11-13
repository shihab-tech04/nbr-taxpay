import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentDateInRange} from '../src/services/paymentDateFilter';

test('payment date bounds include both selected local calendar days',()=>{
  const start=new Date(2026,9,25,0,0,0,0).toISOString();
  const end=new Date(2026,9,25,23,59,59,999).toISOString();
  assert.equal(paymentDateInRange(start,'2026-10-25','2026-10-25'),true);
  assert.equal(paymentDateInRange(end,'2026-10-25','2026-10-25'),true);
});

test('payment date range excludes records outside either bound and accepts one-sided ranges',()=>{
  const before=new Date(2026,9,24,23,59,59,999).toISOString();
  const after=new Date(2026,9,27,0,0,0,0).toISOString();
  const firstDay=new Date(2026,9,25,12,0,0,0).toISOString();
  const lastDay=new Date(2026,9,26,12,0,0,0).toISOString();
  assert.equal(paymentDateInRange(before,'2026-10-25','2026-10-26'),false);
  assert.equal(paymentDateInRange(after,'2026-10-25','2026-10-26'),false);
  assert.equal(paymentDateInRange(firstDay,'2026-10-25',''),true);
  assert.equal(paymentDateInRange(lastDay,'','2026-10-26'),true);
});

test('invalid timestamps, date-only values and reversed bounds fail closed when filtering',()=>{
  assert.equal(paymentDateInRange('not-a-timestamp','2026-10-25',''),false);
  const timestamp=new Date(2026,9,25,12).toISOString();
  assert.equal(paymentDateInRange(timestamp,'2026-02-30',''),false);
  assert.equal(paymentDateInRange(timestamp,'2026-10-26','2026-10-25'),false);
});
