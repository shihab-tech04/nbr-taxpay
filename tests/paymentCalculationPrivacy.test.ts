import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PaymentLiveSummary } from '../src/components/ui/PaymentFormLayout.tsx';

test('167 selected incomplete heads remain in the model, not in the approved compact sidebar', () => {
  const entries = Array.from({length:167}, (_,index) => ({
    id:'line-'+String(index+1), label:'Payment head '+String(index+1),
    detail:'2026-27', value:null,
  }));
  const markup = renderToStaticMarkup(createElement(PaymentLiveSummary,{
    language:'en',category:'Other Tax Payment',hideService:true,
    compactTaxpayerView:true,amount:null,
    groupedBreakdown:[
      {id:'user-1',label:'User 1',tin:'111111111111',amount:null,entries},
      {id:'user-2',label:'User 2',tin:'222222222222',amount:0,entries:[]},
    ],
  }));
  assert.match(markup,/v5-compact-taxpayer-summary/);
  assert.match(markup,/User 1/);
  assert.match(markup,/User 2/);
  assert.match(markup,/Enter amounts for 167 selected heads/);
  assert.match(markup,/111\*\*\*\*/);
  assert.doesNotMatch(markup,/Show all 167 selected heads/);
  assert.doesNotMatch(markup,/payment-form-summary__taxpayer-entries/);
  assert.doesNotMatch(markup,/Payment head 167/);
  assert.doesNotMatch(markup,/Copy TIN|টিআইএন কপি করুন/);
});

test('TIN can be revealed in a payment calculation but never copied there',()=>{
  for(const language of ['en','bn'] as const){
    const markup=renderToStaticMarkup(createElement(PaymentLiveSummary,{
      language,category:'Other Tax Payment',amount:0,tin:'111111111111',
    }));
    assert.match(markup,/payment-summary-tin/);
    assert.doesNotMatch(markup,/Copy TIN|টিআইএন কপি করুন/);
    assert.doesNotMatch(markup,/clipboard|aria-label="Copy/);
    assert.match(markup,language==='en'?/Reveal TIN/:/টিআইএন দেখুন/);
  }
});
