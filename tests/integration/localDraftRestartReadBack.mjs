import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Runs ONLY after supabase stop/start in a disposable local stack.
// A successfully returned INSERT and a second HTTP GET are NOT durable restart proof.
const file = process.env.TAXPAY_LOCAL_RECOVERY_FILE;
const rawApi = process.env.TAXPAY_LOCAL_SUPABASE_URL;
const anon = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
const rawPg = process.env.TAXPAY_LOCAL_PG_DSN;
if (!file || !rawApi || !anon || !rawPg) throw new Error('BLOCKED: missing local recovery file/API/anon key/DB DSN');
const api = new URL(rawApi);
const pg = new URL(rawPg);
if (api.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(api.hostname) ||
    !['postgres:','postgresql:'].includes(pg.protocol) ||
    !['127.0.0.1','localhost','[::1]'].includes(pg.hostname)) {
  throw new Error('Refusing remote database in isolated restart verification');
}
const evidence = JSON.parse(readFileSync(file, 'utf8'));
assert.equal(evidence.owners?.length, 2, 'Expected exactly two previous synthetic owners');
const pgEnv = {
  ...process.env, PGHOST: pg.hostname, PGPORT: pg.port || '5432',
  PGDATABASE: decodeURIComponent(pg.pathname.slice(1)),
  PGUSER: decodeURIComponent(pg.username), PGPASSWORD: decodeURIComponent(pg.password),
  PGCONNECT_TIMEOUT: '5',
};
for (const owner of evidence.owners) {
  assert.match(owner.draftId, /^[0-9a-f-]{36}$/i);
  assert.match(owner.uid, /^[0-9a-f-]{36}$/i);
  assert.match(owner.email, /^taxpay-synthetic-[0-9a-f-]+@example\.invalid$/);
  const credentials = await fetch(new URL('/auth/v1/token?grant_type=password', api.origin), {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: owner.email, password: owner.password }),
  });
  assert.ok(credentials.ok, 'Existing Auth identity did not survive local stack restart');
  const tokens = await credentials.json();
  assert.ok(tokens.access_token);
  const ownRead = await fetch(
    new URL('/rest/v1/taxpay_payment_drafts?select=id,owner_uid,amount_minor,record_status&id=eq.' + owner.draftId, api.origin),
    { headers: { apikey: anon, Authorization: 'Bearer ' + tokens.access_token } }
  );
  assert.equal(ownRead.status, 200);
  assert.deepEqual(await ownRead.json(), [{
    id: owner.draftId, owner_uid: owner.uid, amount_minor: owner.amountMinor,
    record_status: 'DRAFT',
  }]);
  const sql = "select json_build_object('database',current_database(),'id',id,'owner_uid',owner_uid,'amount_minor',amount_minor,'status',record_status) from public.taxpay_payment_drafts where id='" + owner.draftId + "'::uuid;";
  const check = spawnSync('psql', ['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql], {
    encoding: 'utf8', env: pgEnv, timeout: 12000,
  });
  assert.equal(check.status, 0, 'Direct SQL channel unavailable after restart');
  const rows = check.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(rows.length, 1, 'Synthetic draft absent from direct PostgreSQL after restart');
  const row = JSON.parse(rows[0]);
  assert.equal(row.database, evidence.database);
  assert.equal(row.id, owner.draftId);
  assert.equal(row.owner_uid, owner.uid);
  assert.equal(row.amount_minor, owner.amountMinor);
  assert.equal(row.status, 'DRAFT');
  console.log('PASS synthetic owner account and exact draft survive stop/start via Auth, HTTP and SQL');
}
console.log('RESULT 2 independently reauthenticated owner drafts persisted through disposable Supabase restart');
