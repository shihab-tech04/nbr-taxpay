import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MaskedProfileValue} from '../src/components/ui/MaskedProfileValue.tsx';

const tin='222222222222';
function render(kind:'tin'|'phone'|'email',options:{allowCopy?:boolean;profileContext?:boolean}={}){
  return renderToStaticMarkup(createElement(MaskedProfileValue,{
    kind, value:kind==='tin'?tin:kind==='phone'?'01712345678':'user@example.com',
    label:kind==='tin'?'TIN':kind==='phone'?'Mobile number':'Email',
    language:'en', ...options
  }));
}

test('TIN cannot be copied outside the authenticated/profile rendering boundary',()=>{
  assert.doesNotMatch(render('tin',{allowCopy:true}),/aria-label="Copy TIN"/);
  assert.doesNotMatch(render('tin',{profileContext:true}),/aria-label="Copy TIN"/);
  assert.match(render('tin',{allowCopy:true,profileContext:true}),/aria-label="Copy TIN"/);
  assert.match(render('tin',{allowCopy:true,profileContext:true}),/aria-label="Show TIN"/);
  assert.doesNotMatch(render('tin',{allowCopy:true,profileContext:false}),/>222222222222</,
    'masked TIN stays masked until explicit reveal');
});

test('existing non-TIN copy behaviour remains untouched',()=>{
  assert.match(render('email',{allowCopy:true}),/aria-label="Copy Email"/);
  assert.match(render('phone',{allowCopy:true}),/aria-label="Copy Mobile number"/);
  assert.doesNotMatch(render('phone'),/aria-label="Copy Mobile number"/);
});
