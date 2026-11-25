import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentLiveSummary } from '../src/components/ui/PaymentFormLayout.tsx';

const groups = [
  { id:'u1',label:'User 1',tin:'111111111111',amount:null,
    countLabel:'167 payment lines',
    entries:Array.from({length:167},(_,i)=>({
      id:`line-${i}`,label:`Selected head ${i+1}`,detail:'2026-27',value:null
    })) },
  { id:'u2',label:'User 2',tin:'222222222222',amount:null,
    countLabel:'0 payment lines',entries:[] }
];
const render=(progressiveHeads:boolean)=>renderToStaticMarkup(
  React.createElement(PaymentLiveSummary,{
    language:'en',category:'Other Tax Payment',hideService:true,amount:null,
    groupedBreakdown:groups,progressiveHeads,
  })
);
test('payment summaries show masked TIN/reveal but never a TIN clipboard action',()=>{
  for(const progressive of [true,false]){
    const html=render(progressive);
    assert.match(html,/aria-label="Reveal TIN"/);
    assert.doesNotMatch(html,/Copy TIN|navigator.clipboard|TIN copied/);
    assert.doesNotMatch(html,/111111111111|222222222222/);
    assert.match(html,/111\*\*\*\*/);
    assert.match(html,/222\*\*\*\*/);
  }
});
test('167 lines preserve identity and next taxpayer without rendering every row at once',()=>{
  const html=render(true);
  assert.match(html,/167 payment lines/);
  assert.match(html,/0 payment lines/);
  assert.match(html,/Show next 20 selected heads/);
  assert.match(html,/163 more heads/);
  assert.match(html,/Selected head 4/);
  assert.doesNotMatch(html,/Selected head 5/);
  assert.match(html,/User 2/);
  assert.match(html,/Select payment heads and amounts in Step 2/);
  assert.match(html,/aria-controls="payment-heads-u1"/);
  assert.doesNotMatch(html,/selected payment credit|SIMULATED_SUCCESS/);
});
test('legacy grouped calculation keeps existing show-all behavior',()=>{
  const html=render(false);
  assert.match(html,/Show all 167 selected heads/);
  assert.match(html,/163 more heads/);
});
