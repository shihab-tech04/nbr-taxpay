import test from 'node:test';
import assert from 'node:assert/strict';
import {rankFrequentTaxCategoryNames, rankFrequentTaxHeadIds} from '../src/services/paymentFrequentCategories';
import type {SimulationTransaction, SimulationCategory} from '../src/contracts/paymentSimulationContract';

const paid = (category: SimulationCategory, day: number, state: SimulationTransaction['state']='SIMULATED', allocations: SimulationCategory[]=[category]) => ({
  state, createdAt: '2026-11-'+String(day).padStart(2,'0')+'T10:00:00.000Z',
  allocations: allocations.map((item,i)=>({id:'item'+i,lineNo:i+1,category:item,beneficiary:'user1' as const,assessmentYear:'2026-27',amountMinor:100})),
});

test('five favorites count distinct completed transactions and break frequency ties by recency',()=>{
  const rows = [paid('PENALTY',21),paid('PENALTY',20),paid('PENALTY',19),
    paid('SOURCE_TAX_DEPOSIT',22),paid('SOURCE_TAX_DEPOSIT',18),
    paid('TAX_WITH_RETURN',17,'SIMULATED',['TAX_WITH_RETURN','TAX_WITH_RETURN']),
    paid('ADVANCE_TAX',16),paid('ASSESSED_DEMAND',15),paid('OTHER_TAX_PAYMENT',14),paid('APPELLATE_TRIBUNAL',13),
    paid('ADVANCE_TAX',22,'FAILED'),paid('TAX_WITH_RETURN',23,'PENDING')];
  assert.deepEqual(rankFrequentTaxCategoryNames(rows), ['Penalty','Source Tax','Tax with Return','Advance Tax','Tax against Demand']);
});
test('never invent favorites for empty, unsuccessful, corrupt, or absent history',()=>{
  assert.deepEqual(rankFrequentTaxCategoryNames([]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('ADVANCE_TAX',17,'FAILED')]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([{...paid('PENALTY',20),createdAt:'invalid'}]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20)],0), []);
});

test('first-time and single completed-payment accounts receive no suggestions',()=>{
  assert.deepEqual(rankFrequentTaxCategoryNames([]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20)]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20),paid('ADVANCE_TAX',22,'FAILED')]), []);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20),paid('ADVANCE_TAX',22,'PENDING')]), []);
});
test('two completed payments enable recommendations without inventing five categories',()=>{
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20),paid('PENALTY',21)]), ['Penalty']);
  assert.deepEqual(rankFrequentTaxCategoryNames([paid('PENALTY',20),paid('ADVANCE_TAX',21)]), ['Advance Tax','Penalty']);
});

test('exact-head favorites count paid transactions, deduplicate lines, cap at five and never infer from category',()=>{
  const catalogue=new Map([[1,'16A'],[2,'16F'],[3,'16G'],[8,'50'],[121,'64'],[123,'68B']]);
  const row=(day:number,allocations:unknown[],state='SIMULATED')=>({state,createdAt:'2026-11-'+day+'T10:00:00Z',allocations});
  const h=(headId:number,economicCode:string)=>({headId,economicCode});
  const a=row(20,[h(121,'64'),h(121,'64'),h(8,'50'),h(123,'68B'),h(1,'16A'),h(2,'16F'),h(3,'16G')]);
  const b=row(21,[h(121,'64'),h(8,'50'),h(999,'64'),h(123,'WRONG'),{category:'ADVANCE_TAX'}]);
  assert.deepEqual(rankFrequentTaxHeadIds([a],catalogue),[]);
  assert.deepEqual(rankFrequentTaxHeadIds([a,b,row(22,[h(3,'16G')],'FAILED')],catalogue),[8,121,1,2,3]);
  assert.deepEqual(rankFrequentTaxHeadIds([row(20,[{category:'ADVANCE_TAX'}]),row(21,[{category:'ADVANCE_TAX'}])],catalogue),[]);
  assert.deepEqual(rankFrequentTaxHeadIds([a,b],catalogue,10).length,5);
});
