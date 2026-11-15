import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRANDING_402_COOLDOWN_MS,
  allowBrandingManualRetry,
  brandingRequestsAllowed,
  noteBrandingHttpStatus,
} from '../src/services/brandingRequestGuard';

test('one CMS 402 prevents repeated logo and banner requests until cooldown', () => {
  const start = 1000;
  assert.equal(brandingRequestsAllowed(start), true);
  noteBrandingHttpStatus(200, start);
  assert.equal(brandingRequestsAllowed(start), true);
  noteBrandingHttpStatus(402, start);
  assert.equal(brandingRequestsAllowed(start + 10_000), false);
  noteBrandingHttpStatus(402, start + 1000);
  assert.equal(brandingRequestsAllowed(start + BRANDING_402_COOLDOWN_MS), false);
  assert.equal(brandingRequestsAllowed(start + BRANDING_402_COOLDOWN_MS + 1000), true);
});

test('visitor retry is controlled and cannot create a rapid request loop', () => {
  const start = 2_000_000;
  noteBrandingHttpStatus(402, start);
  assert.equal(allowBrandingManualRetry(start + 1000), true);
  assert.equal(brandingRequestsAllowed(start + 1000), true);
  noteBrandingHttpStatus(402, start + 1001);
  assert.equal(allowBrandingManualRetry(start + 2000), false);
  assert.equal(brandingRequestsAllowed(start + 2000), false);
  assert.equal(allowBrandingManualRetry(start + 61_001), true);
  assert.equal(brandingRequestsAllowed(start + 61_001), true);
});
