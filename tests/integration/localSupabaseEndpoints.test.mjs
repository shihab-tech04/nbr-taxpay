import assert from 'node:assert/strict';
import {test} from 'node:test';
import {localSupabaseEndpoints} from './localSupabaseEndpoints.mjs';
const ci = {GITHUB_ACTIONS:'true', TAXPAY_LOCAL_API_PORT:'38121', TAXPAY_LOCAL_DB_PORT:'38122',
 TAXPAY_LOCAL_SUPABASE_URL:'http://127.0.0.1:38121', TAXPAY_LOCAL_PG_DSN:'postgresql://postgres:postgres@127.0.0.1:38122/postgres'};
test('accepts exact allocated loopback endpoints and manual local defaults',()=>{
 assert.deepEqual(localSupabaseEndpoints(ci),{origin:'http://127.0.0.1:38121',dbPort:'38122'});
 assert.deepEqual(localSupabaseEndpoints({}),{origin:'http://127.0.0.1:54321',dbPort:'54322'});
});
test('CI cannot fall back to an unrelated fixed-port job',()=>{
 for(const name of ['TAXPAY_LOCAL_API_PORT','TAXPAY_LOCAL_DB_PORT','TAXPAY_LOCAL_SUPABASE_URL','TAXPAY_LOCAL_PG_DSN']) {
  const env={...ci}; delete env[name]; assert.throws(()=>localSupabaseEndpoints(env));
 }
 assert.throws(()=>localSupabaseEndpoints({...ci,TAXPAY_LOCAL_DB_PORT:'38121'}));
});
test('rejects mismatched ports, remote hosts, credentials, paths and invalid numeric ports',()=>{
 for(const origin of ['https://127.0.0.1:38121','http://example.com:38121','http://127.0.0.1:54321','http://user@127.0.0.1:38121','http://127.0.0.1:38121/rest/v1'])
  assert.throws(()=>localSupabaseEndpoints({...ci,TAXPAY_LOCAL_SUPABASE_URL:origin}));
 for(const db of ['postgresql://postgres@remote.example:38122/postgres','postgresql://postgres@127.0.0.1:54322/postgres','postgresql://postgres@127.0.0.1:38122/other'])
  assert.throws(()=>localSupabaseEndpoints({...ci,TAXPAY_LOCAL_PG_DSN:db}));
 for(const value of ['0','65536','a','1;echo']) assert.throws(()=>localSupabaseEndpoints({...ci,TAXPAY_LOCAL_DB_PORT:value}));
});
