import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedBeneficiaryTin } from '../src/services/taxpayerTinValidation';

test('ordinary guest TIN validation remains twelve digits', () => {
  assert.equal(isSupportedBeneficiaryTin('123456789012', false), true);
  for (const tin of ['12345678901', '1234567890123', '2222222222222', '12345678901x', ' 123456789012']) {
    assert.equal(isSupportedBeneficiaryTin(tin, false), false, tin);
  }
});

test('the demo context permits only known fictional thirteen-digit identities', () => {
  assert.equal(isSupportedBeneficiaryTin('2222222222222', true), true);
  assert.equal(isSupportedBeneficiaryTin('1010101010101', true), true);
  assert.equal(isSupportedBeneficiaryTin('123456789012', true), true);
  assert.equal(isSupportedBeneficiaryTin('1234567890123', true), false);
  assert.equal(isSupportedBeneficiaryTin('0000000000000', true), false);
});
