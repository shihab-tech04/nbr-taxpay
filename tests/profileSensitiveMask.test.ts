import test from 'node:test';
import assert from 'node:assert/strict';
import {maskProfileValue,sensitiveProfileKind} from '../src/components/ui/MaskedProfileValue';

test('TIN and phone values retain only the first three digits',()=>{
  assert.equal(maskProfileValue('577935451798','tin'),'577*********');
  assert.equal(maskProfileValue('+8801857648765','phone'),'+880**********');
  assert.equal(maskProfileValue('02-9588253','phone'),'02-9******');
  assert.equal(maskProfileValue('123','tin'),'***');
});
test('email keeps two local characters but never shows the private domain',()=>{
  assert.equal(maskProfileValue('email@test.com','email'),'em***@****.***');
  assert.equal(maskProfileValue('a@x.io','email'),'a***@****.***');
});
test('sensitive fields are identified without masking normal certificate text',()=>{
  assert.equal(sensitiveProfileKind('tin','577935451798'),'tin');
  assert.equal(sensitiveProfileKind('previousTin','123456789012'),'tin');
  assert.equal(sensitiveProfileKind('previousTin','Not Applicable'),null);
  assert.equal(sensitiveProfileKind('mobileNumber','+8801857648765'),'phone');
  assert.equal(sensitiveProfileKind('taxOfficePhone','02-9588253'),'phone');
  assert.equal(sensitiveProfileKind('emailAddress','email@test.com'),'email');
  assert.equal(sensitiveProfileKind('emailAddress','Not available'),null);
  assert.equal(sensitiveProfileKind('taxpayerName','Md. Arif Rahman'),null);
});
