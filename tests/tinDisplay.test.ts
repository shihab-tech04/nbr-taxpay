import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {maskTinForDisplay} from '../src/services/tinDisplay';

test('one canonical TIN mask preserves correct 12/13-digit length', () => {
  assert.equal(maskTinForDisplay('333333333333'), '333*********');
  assert.equal(maskTinForDisplay('2222222222222'), '222**********');
  assert.equal(maskTinForDisplay(''), '');
  assert.equal(maskTinForDisplay(null), '');
  assert.equal(maskTinForDisplay('123'), '***');
});
test('no passive full TIN interpolation at the reviewed non-Profile entry points', () => {
  const source = (path: string) => readFileSync(path,'utf8');
  const checks: Array<[string,string]> = [
    ['src/components/screens/Beneficiaries.tsx','>{person.tin}<'],
    ['src/components/screens/Beneficiaries.tsx','>{editPerson.tin}<'],
    ['src/components/screens/SavedBeneficiaryPicker.tsx','>{selectedFallback.tin}<'],
    ['src/components/screens/SavedBeneficiaryPicker.tsx','>{person.tin}<'],
    ['src/components/screens/ManageAuthorization.tsx','>{person.tin}<'],
    ['src/components/screens/GuestPayment.tsx','>{item.receipt.taxpayerTin}'],
  ];
  for(const [file,raw] of checks) {
    assert.ok(!source(file).includes(raw), file+' leaks a full passive TIN');
  }
});
test('the master result is not a clipboard/copy affordance', () => {
  const source=readFileSync('src/components/ui/TaxpayerTinLookup.tsx','utf8');
  assert.ok(source.includes('maskTinForDisplay(tin)'));
  assert.doesNotMatch(source,/clipboard\.writeText/);
});
