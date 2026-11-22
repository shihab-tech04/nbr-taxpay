import test from 'node:test';
import assert from 'node:assert/strict';
import {rankFrequentTaxCategoryNames} from '../src/services/paymentFrequentCategories';
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
