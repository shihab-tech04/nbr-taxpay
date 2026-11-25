import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
const register=JSON.parse(readFileSync('src/design-system/mui-v51-coverage.json','utf8'));
test('classified review/activity JSX contains real scoped MUI controls, no native button regressions',()=>{
  for(const file of new Set<string>(register.items.map((i:{file:string})=>i.file))){
    const source=readFileSync(file,'utf8');
    const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
    let actual=0,raw=0;
    function walk(value:unknown){
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){value.forEach(walk);return;}
      const n=value as Record<string,unknown>;
      if(n.type==='JSXOpeningElement'){
        const name=n.name as {type?:string;name?:string};
        if(name.name==='MuiButtonBase')actual++;
        if(name.name==='button')raw++;
      }
      for(const [key,child] of Object.entries(n))if(!['loc','start','end','comments','tokens'].includes(key))walk(child);
    }
    walk(ast);
    assert.equal(raw,0,file+' contains native button');
    assert.equal(actual,register.items.filter((i:{file:string})=>i.file===file).length,file+' classified control count');
    assert.match(source,/import \{CitizenMuiScope,MuiButtonBase\} from '\.\.\/\.\.\/design-system\/mui'/);
    assert.match(source,/<CitizenMuiScope>/);
  }
});
