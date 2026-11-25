import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TaxPayOfficeRegisterToolbar,TaxPayActiveFilterChips,TaxPayTablePagination,TaxPayCompactCellList,TaxPayDataGrid} from '../src/components/ui/TaxPayDataTable';
import {MuiRecordControlsScope} from '../src/design-system/mui-record-adapters';
import {CitizenMuiScope} from '../src/design-system/mui';
const noop=()=>{};
const render=(child:React.ReactNode,mui:boolean)=>renderToStaticMarkup(mui?<CitizenMuiScope><MuiRecordControlsScope>{child}</MuiRecordControlsScope></CitizenMuiScope>:<>{child}</>);
test('record actions and search are actual MUI only in explicitly opted-in regions',()=>{
 const children=<>
   <TaxPayOfficeRegisterToolbar title="Records" count={1} countLabel="record" searchValue="abc" searchLabel="Search records" onSearchChange={noop} onToggleFilters={noop} filterLabel="Filter"/>
   <TaxPayActiveFilterChips filters={[{key:'a',label:'Year',onRemove:noop}]} clearLabel="Clear all" onClear={noop}/>
   <TaxPayTablePagination page={1} perPage={2} total={10} onPageChange={noop}/>
   <TaxPayCompactCellList items={['one','two']} getKey={i=>i} renderItem={i=>i} moreLabel={n=>n+' more'} onShowAll={noop}/>
   <TaxPayDataGrid variant="tabular" rows={[]} columns={[]} getRowKey={()=>''} ariaLabel="Failed records" error="Read failed" onRetry={noop}/>
 </>;
 const native=render(children,false),mui=render(children,true);
 assert.doesNotMatch(native,/MuiButtonBase-root|MuiInputBase-input/);
 assert.match(native,/<input[^>]+type="search"/);
 assert.match(mui,/MuiButtonBase-root/);
 assert.match(mui,/MuiInputBase-input/);
 for(const id of ['FILTER-TOGGLE','CHIP-REMOVE','CHIP-CLEAR','PAGE-PREVIOUS','PAGE-NUMBER','PAGE-NEXT','COMPACT-MORE','RETRY-TABLE','OFFICE-SEARCH']){
  assert.match(mui,new RegExp('data-mui-coverage="MUI-RECORD-'+id+'"'));
  assert.match(native,new RegExp('data-mui-coverage="MUI-RECORD-'+id+'"'));
 }
 assert.match(mui,/aria-label="Previous"[^>]*disabled|disabled=""[^>]*aria-label="Previous"/);
 assert.match(mui,/aria-current="page"/);
});
