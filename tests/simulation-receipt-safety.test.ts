import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { AcsTreasuryAdapter } from '../src/services/adapters';

test('an unconfigured official Treasury adapter cannot invent a challan or scroll', async () => {
  await assert.rejects(AcsTreasuryAdapter.issueChallan({
    tin: '123456789012', amount: 100, headCode: '1111101', assessmentYear: '2026-27', method: 'BKASH',
  }), /not configured/);
});
