import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
test('bulk remove stays subdued after Pay and Clear and requires the existing confirmation',()=>{
  const start=page.indexOf('<div className="beneficiary-directory__bulk-actions">');
  const end=page.indexOf('</div>',start);
  assert.ok(start>=0&&end>start);
  const actions=page.slice(start,end);
  const pay=actions.indexOf("tr('Pay Tax for Others'");
  const clear=actions.indexOf("tr('Clear','মুছুন')");
  const remove=actions.indexOf("tr('Remove selected','নির্বাচিতদের সরান')");
  assert.ok(pay>=0&&clear>pay&&remove>clear,'destructive action follows positive and reset actions');
  assert.match(actions,/variant="quiet" disabled=\{busy\} className="gap-2 text-taxpay-muted hover:text-taxpay-error"/);
  assert.match(page,/\{bulkRemoveIds&&<TaxPayModal/,'bulk removal still requires confirmation');
  assert.match(page,/onClick=\{\(\)=>void confirmBulkRemove\(\)\}/);
});
