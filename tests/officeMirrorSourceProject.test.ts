import test from 'node:test';
import assert from 'node:assert/strict';
import {officeMirrorSourceForEndpoint as source} from '../supabase/functions/demo-story1-taxpay/officeMirrorSource';

test('production original always signs original-source Office mirror',()=>{
  assert.equal(source('https://eyqhoavnitkrajvyqvxn.supabase.co'),'original');
});
test('production V2 always signs V2-source Office mirror',()=>{
  assert.equal(source('https://gmuhitmaynfhipcvbvkh.supabase.co'),'v2');
});
test('disposable loopback tests preserve original fixture semantics',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]'])
    assert.equal(source('http://'+host+':54321'),'original');
});
test('invalid, external, Office, userinfo, file and malformed URLs fail closed',()=>{
  for(const url of ['', 'invalid', 'https://evil.invalid',
    'https://ihbtabrvmyiwikqqbhrf.supabase.co',
    'https://attacker@gmuhitmaynfhipcvbvkh.supabase.co',
    'https://eyqhoavnitkrajvyqvxn.supabase.co.evil.invalid',
    'file:///tmp/local','ftp://localhost:54321','http://gmuhitmaynfhipcvbvkh.supabase.co',
    'http://eyqhoavnitkrajvyqvxn.supabase.co'])
    assert.throws(()=>source(url),/UNRECOGNIZED_TAXPAYER_SOURCE/);
});
