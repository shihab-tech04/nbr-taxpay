import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBdtMinorUnits } from '../src/services/minorUnitFormatting.ts';

test('minor-unit formatting preserves one cent and two decimals', () => {
 assert.equal(formatBdtMinorUnits(1), '0.01');
 assert.equal(formatBdtMinorUnits(100), '1.00');
 assert.equal(formatBdtMinorUnits(105), '1.05');
 assert.equal(formatBdtMinorUnits(0), '0.00');
});
test('largest allowed amount is formatted exactly without floating-point cents loss',()=>{
 const highest = formatBdtMinorUnits(99999999999999);
 assert.ok(highest.endsWith('999.99'));
 assert.equal(highest.replace(/,/g, ''), '999999999999.99');
 assert.equal(formatBdtMinorUnits(1, 'bn'), '০.০১');
 assert.equal(formatBdtMinorUnits(105, 'bn'), '১.০৫');
});
test('reject unsafe, fractional and negative input',()=>{
 for(const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
   assert.throws(() => formatBdtMinorUnits(invalid), /Invalid integer/);
});
