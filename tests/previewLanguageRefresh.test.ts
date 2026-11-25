import assert from 'node:assert/strict';
import {test} from 'node:test';

process.env.VITE_SUPABASE_URL='https://preview-language-test.invalid';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='test-key';
delete process.env.VITE_SUPABASE_DISABLED;

const storage=new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{
  getItem:(key:string)=>storage.get(key)??null,
  setItem:(key:string,value:string)=>{storage.set(key,value);},
  removeItem:(key:string)=>{storage.delete(key);},
}}});
const session=await import('../src/services/previewAccountSession');
const originalFetch=globalThis.fetch;
const login={profileId:'user27',capability:'a'.repeat(43),paymentSessionId:'00000000-0000-4000-8000-000000000027',language:'en',selectedListId:null};
const response=(data:unknown)=>new Response(JSON.stringify({success:true,data}),{status:200});

test('a pending preview language survives a stale session read and clears only after acknowledged save or logout',async()=>{
  let confirm:(response:Response)=>void=()=>{throw Error('Expected a pending language write');};
  globalThis.fetch=async(_input,init)=>{
    const body=JSON.parse(String(init?.body));
    if(body.action==='demo-login')return response(login);
    if(body.key==='language')return new Promise<Response>(resolve=>{confirm=resolve;});
    return response(login);
  };
  try {
    await session.signInPreviewProfile('user27','user27');
    const save=session.savePreviewSetting('language','bn');
    assert.equal(session.pendingPreviewLanguage(),'bn');
    assert.equal(session.activePreviewSession()?.language,'en');
    await session.getPreviewSettings();
    assert.equal(session.pendingPreviewLanguage(),'bn');
    assert.equal(session.activePreviewSession()?.language,'en');
    confirm(response({...login,language:'bn'}));
    await save;
    assert.equal(session.activePreviewSession()?.language,'bn');
    assert.equal(session.pendingPreviewLanguage(),null);
    const interrupted=session.savePreviewSetting('language','en');
    assert.equal(session.pendingPreviewLanguage(),'en');
    session.clearPreviewSession();
    await assert.rejects(interrupted,/Demo account changed/);
    assert.equal(session.pendingPreviewLanguage(),null);
    await session.signInPreviewProfile('user27','user27');
    assert.equal(session.pendingPreviewLanguage(),null);
    assert.equal(session.activePreviewSession()?.language,'en');
  }finally{globalThis.fetch=originalFetch;session.clearPreviewSession();}
});
