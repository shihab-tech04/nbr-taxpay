import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Button,Input,Select,Textarea} from '../src/design-system';
import {UiButton,UiInput,UiSelect,UiTextarea} from '../src/components/ui/Controls';

test('legacy and canonical controls share exactly the same React implementation',()=>{
  assert.equal(Button,UiButton);
  assert.equal(Input,UiInput);
  assert.equal(Select,UiSelect);
  assert.equal(Textarea,UiTextarea);
});

test('button preserves native semantics, all existing variants and Bengali labels',()=>{
  const primary=renderToStaticMarkup(createElement(Button,{disabled:true},'সংরক্ষণ'));
  assert.match(primary,/type="button"/);
  assert.match(primary,/disabled=""/);
  assert.match(primary,/bg-taxpay-primary/);
  assert.match(primary,/সংরক্ষণ/);
  const outline=renderToStaticMarkup(createElement(Button,{variant:'outline',type:'submit',className:'consumer-class'},'Save'));
  assert.match(outline,/type="submit"/);
  assert.match(outline,/border-taxpay-border/);
  assert.match(outline,/consumer-class/);
  assert.match(renderToStaticMarkup(createElement(Button,{variant:'quiet'},'Cancel')),/bg-transparent/);
});

test('native controls preserve form, validation and accessibility attributes',()=>{
  const input=renderToStaticMarkup(createElement(Input,{id:'tin',name:'tin',required:true,'aria-invalid':true,'aria-describedby':'tin-error',defaultValue:'123'}));
  for(const token of ['id="tin"','name="tin"','required=""','aria-invalid="true"','aria-describedby="tin-error"','value="123"'])assert.ok(input.includes(token),token);
  const select=renderToStaticMarkup(createElement(Select,{name:'head',defaultValue:'a'},createElement('option',{value:'a'},'অগ্রিম কর')));
  assert.match(select,/name="head"/);
  assert.match(select,/selected=""/);
  assert.match(select,/অগ্রিম কর/);
  const textarea=renderToStaticMarkup(createElement(Textarea,{readOnly:true,defaultValue:'Remarks'}));
  assert.match(textarea,/readonly=""/i);
  assert.match(textarea,/Remarks/);
});
