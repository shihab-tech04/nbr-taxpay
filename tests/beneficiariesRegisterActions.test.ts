import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
const styles=readFileSync('src/styles/taxpay-unified-table.css','utf8');

test('All beneficiaries selects every saved record without changing ownership or list membership',()=>{
  assert.match(page,/const listPeople=activeList==='all'\?people:people\.filter\(person=>person\.list_id===activeList\)/);
  assert.match(page,/rememberedBeneficiaryListId\(\[\{id:'all'\},\.\.\.data\.lists\]/);
  assert.match(page,/onClick=\{\(\)=>switchList\('all'\)\}/);
  assert.match(page,/person\.id===id&&\(activeList==='all'\|\|person\.list_id===activeList\)/);
  assert.match(page,/const filteredPeople=listPeople\.filter/);
  assert.match(page,/const selectedPeople=listPeople\.filter/);
});

test('Beneficiaries has one Office-style search/filter toolbar and no extra list-context strip',()=>{
  assert.match(page,/<TaxPayOfficeRegisterToolbar/);
  assert.match(page,/actions=\{<div className="beneficiary-directory__list-toolbar">/);
  assert.match(page,/<TaxPayOfficeRegisterFilters open=\{filtersExpanded\}/);
  assert.doesNotMatch(page,/className="beneficiary-directory__list-context"/);
  assert.match(styles,/\.taxpay-office-register__actions \.beneficiary-directory__list-toolbar/);
});

test('Each record has exactly Edit and secondary Make payment; deletion is confirmed inside Edit',()=>{
  const table=page.slice(page.indexOf("{key:'actions'"),page.indexOf('renderMobileCard=',page.indexOf("{key:'actions'")));
  const mobile=page.slice(page.indexOf('renderMobileCard='),page.indexOf('ariaLabel={tr(\'Saved beneficiaries\'',page.indexOf('renderMobileCard=')));
  for(const [label,part] of [['desktop',table],['mobile',mobile]]){
    assert.equal((part.match(/<UiButton /g)||[]).length,2,label+' actions');
    assert.match(part,/openPersonEditor\(person\)/,label+' Edit');
    assert.match(part,/payWith\(\[person\]\)/,label+' Make payment');
    assert.match(part,/variant="outline"/,label+' secondary styling');
    assert.doesNotMatch(part,/setDeletePerson\(person\)/,label+' row deletion removed');
  }
  assert.match(page,/\{editPerson&&!deletePerson&&<TaxPayModal/);
  assert.match(page,/setDeletePerson\(editPerson\)/);
  assert.match(page,/Delete beneficiary/);
  assert.match(page,/Confirm beneficiary removal/);
  assert.match(page,/setEditPerson\(null\);setModalError\(''\)/);
  assert.doesNotMatch(styles,/\.beneficiary-directory__table \.taxpay-mobile-table-card__actions > button:nth-child\(3\)/);
});
