import assert from 'node:assert/strict';
import test from 'node:test';
import { TAXPAYER_BRAND, taxpayerBrandName } from '../src/config/brand';

test('the approved public and taxpayer brand is bilingual and has a single source', () => {
  assert.equal(taxpayerBrandName('bn'), 'আমার কর');
  assert.equal(taxpayerBrandName('en'), 'Amar Kor');
  assert.equal(TAXPAYER_BRAND.tagline.bn, 'আপনার কর, আপনার হিসাব');
  assert.equal(TAXPAYER_BRAND.tagline.en, 'Your tax, your records');
});
