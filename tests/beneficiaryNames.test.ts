import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  BENEFICIARY_NAME_NOT_PROVIDED,
  beneficiaryNameForDisplay,
  beneficiaryNameForPrefill,
  beneficiaryNameForStorage,
  beneficiaryNameWasNotProvided,
} from '../src/services/beneficiaryNames';

test('an omitted name remains a non-identity fallback and is never sent as a taxpayer name',()=>{
  const stored=beneficiaryNameForStorage('  ');
  assert.equal(stored,BENEFICIARY_NAME_NOT_PROVIDED);
  assert.equal(beneficiaryNameWasNotProvided(stored),true);
  assert.equal(beneficiaryNameForDisplay(stored,'Name not provided'),'Name not provided');
  assert.equal(beneficiaryNameForPrefill(stored),'');
});

test('a supplied name is trimmed and preserved for display and payment prefill',()=>{
  const stored=beneficiaryNameForStorage('  Synthetic Contact  ');
  assert.equal(stored,'Synthetic Contact');
  assert.equal(beneficiaryNameWasNotProvided(stored),false);
  assert.equal(beneficiaryNameForDisplay(stored,'Name not provided'),'Synthetic Contact');
  assert.equal(beneficiaryNameForPrefill(stored),'Synthetic Contact');
});
