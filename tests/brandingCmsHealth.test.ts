import assert from 'node:assert/strict';
import test from 'node:test';
import { BRANDING_402_COOLDOWN_MS, brandingReadsAllowed, noteBrandingResponse } from '../src/services/brandingCmsHealth';

test('branding readers share a bounded 402 circuit breaker', () => {
  const now = Date.now();
  assert.equal(brandingReadsAllowed(now), true);
  noteBrandingResponse(200, false, now);
  assert.equal(brandingReadsAllowed(now), true);
  noteBrandingResponse(402, true, now);
  assert.equal(brandingReadsAllowed(now + 1000), false);
  noteBrandingResponse(500, true, now + 1000);
  assert.equal(brandingReadsAllowed(now + BRANDING_402_COOLDOWN_MS - 1), false);
  assert.equal(brandingReadsAllowed(now + BRANDING_402_COOLDOWN_MS + 1000), true);
});
