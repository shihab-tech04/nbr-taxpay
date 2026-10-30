import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';
const MIGRATIONS = [
  '202610100001_taxpay_drafts.sql',
  '202610100002_restrict_auto_rls_helper.sql',
  '202610100003_source_candidate_registry.sql',
  '202610100004_unverified_head_change_proposals.sql',
  '202610100005_correction_inquiries.sql',
  '202610100006_correction_change_proposals.sql',
  '202610110001_taxpay_draft_owner_updates.sql',
  '20261029170000_taxpay_correction_office_readback.sql',
];

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    CREATE FUNCTION public.rls_auto_enable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RETURN NEW; END;
    $$;
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_A}', 'synthetic-a@example.invalid'),
      ('${USER_B}', 'synthetic-b@example.invalid');
  `);

  for (const migration of MIGRATIONS) {
    const url = new URL(`../../supabase/migrations/${migration}`, import.meta.url);
    await db.exec(await readFile(url, 'utf-8'));
  }
  return db;
}

async function assumeIdentity(db: PGlite, role: 'anon' | 'authenticated', userId: string | null) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`SET ROLE ${role}`);
}

async function expectPgError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: { code?: string }) => error.code === code);
}

function typedRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

Deno.test('all current migrations execute and preserve the 170 fail-closed source identities', async () => {
  const db = await createDatabase();
  try {
    await assumeIdentity(db, 'anon', null);
    const result = await db.query(`
      SELECT source_head_id, verification_status, executable, source_map
      FROM public.taxpay_head_source_candidates
      WHERE source_key = 'V11-HTML-20261010'
      ORDER BY source_head_id
    `);
    const sourceRows = typedRows<{ source_head_id: number; verification_status: string; executable: boolean; source_map: string }>(result.rows);
    assert.equal(sourceRows.length, 170);
    assert.deepEqual(sourceRows.map((row) => row.source_head_id), Array.from({ length: 170 }, (_, i) => i + 1));
    assert.equal(sourceRows.every((row) => row.verification_status === 'UNVERIFIED' && row.executable === false), true);
    assert.deepEqual(sourceRows.filter((row) => row.source_map === 'OWNER_REVIEW').map((row) => row.source_head_id), [5, 150]);
    const helperPrivileges = await db.query(`
      SELECT has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') AS anon_can_execute,
             has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') AS user_can_execute
    `);
    assert.deepEqual(typedRows<{ anon_can_execute: boolean; user_can_execute: boolean }>(helperPrivileges.rows)[0], {
      anon_can_execute: false,
      user_can_execute: false,
    });
  } finally {
    await db.close();
  }
});

Deno.test('PGlite filesystem database preserves a synthetic row after close and reopen', async () => {
  const root = Deno.env.get('TAXPAY_TEST_DATA_DIR');
  if (!root) throw new Error('TAXPAY_TEST_DATA_DIR must point to the isolated evidence temp directory');
  const dataDir = await Deno.makeTempDir({ dir: root, prefix: 'pglite-recovery-' });
  let db: PGlite | undefined;
  try {
    db = new PGlite(dataDir);
    await db.exec(`CREATE TABLE recovery_probe (id integer PRIMARY KEY, marker text NOT NULL);
      INSERT INTO recovery_probe VALUES (1, 'SYNTHETIC-RECOVERY');`);
    await db.close();
    db = new PGlite(dataDir);
    const rows = await db.query('SELECT marker FROM recovery_probe WHERE id = 1');
    assert.deepEqual(typedRows<{ marker: string }>(rows.rows), [{ marker: 'SYNTHETIC-RECOVERY' }]);
  } finally {
    await db?.close();
    await Deno.remove(dataDir, { recursive: true });
  }
});

Deno.test('synthetic authenticated owners are isolated across private drafts, proposals, and correction inquiries', async () => {
  const db = await createDatabase();
  try {
    const seeded = await db.query(`
      INSERT INTO public.taxpay_payment_drafts
        (owner_uid, purpose, category, assessment_year, amount_minor)
      VALUES ($1, 'TAX_LIABILITY_PAYMENT', 'TAX_WITH_RETURN', '2026-27', 200)
      RETURNING id
    `, [USER_B]);
    const draftB = typedRows<{ id: string }>(seeded.rows)[0].id;

    await assumeIdentity(db, 'authenticated', USER_A);
    const ownDraft = await db.query(`
      INSERT INTO public.taxpay_payment_drafts
        (owner_uid, purpose, category, assessment_year, amount_minor)
      VALUES ($1, 'TAX_LIABILITY_PAYMENT', 'TAX_WITH_RETURN', '2026-27', 100)
      RETURNING id
    `, [USER_A]);
    const draftA = typedRows<{ id: string }>(ownDraft.rows)[0].id;
    assert.equal((await db.query('SELECT id FROM public.taxpay_payment_drafts')).rows.length, 1);
    await expectPgError(db.query(`
      INSERT INTO public.taxpay_payment_drafts
        (owner_uid, purpose, category, assessment_year, amount_minor)
      VALUES ($1, 'TAX_LIABILITY_PAYMENT', 'TAX_WITH_RETURN', '2026-27', 100)
    `, [USER_B]), '42501');
    assert.equal((await db.query('DELETE FROM public.taxpay_payment_drafts WHERE id = $1 RETURNING id', [draftB])).rows.length, 0);
    const updatedDraft = await db.query(`
      UPDATE public.taxpay_payment_drafts
      SET amount_minor = $1, memo = $2
      WHERE id = $3
      RETURNING id, amount_minor, memo
    `, [125, 'Synthetic resumed edit', draftA]);
    assert.deepEqual(typedRows<{ id: string; amount_minor: number; memo: string }>(updatedDraft.rows), [
      { id: draftA, amount_minor: 125, memo: 'Synthetic resumed edit' },
    ]);
    assert.equal((await db.query(`
      UPDATE public.taxpay_payment_drafts SET memo = 'cross-owner attempt'
      WHERE id = $1 RETURNING id
    `, [draftB])).rows.length, 0);
    await expectPgError(db.query('UPDATE public.taxpay_payment_drafts SET owner_uid = $1 WHERE id = $2', [USER_B, draftA]), '42501');

    const proposal = await db.query(`
      INSERT INTO public.taxpay_head_change_proposals
        (proposer_uid, source_key, source_head_id, source_document_sha256, proposed_patch, submission_reason)
      VALUES ($1, 'V11-HTML-20261010', 1, repeat('a', 64), '{"label":"synthetic review"}', 'Synthetic proposal for RLS testing')
      RETURNING proposal_id, proposal_state, financial_execution_enabled, authority_reviewed
    `, [USER_A]);
    const proposalRow = typedRows<{ proposal_id: string; proposal_state: string; financial_execution_enabled: boolean; authority_reviewed: boolean }>(proposal.rows)[0];
    assert.deepEqual(proposalRow, {
      proposal_id: proposalRow.proposal_id,
      proposal_state: 'PROPOSED_UNVERIFIED',
      financial_execution_enabled: false,
      authority_reviewed: false,
    });
    const inquiry = await db.query(`
      INSERT INTO public.taxpay_correction_inquiries
        (requester_uid, original_reference, reason, requested_outcome, change_kind, old_value, new_value)
      VALUES ($1, 'SYN-REF-001', 'Synthetic evidence-pending request', 'Review this synthetic reference', 'CIRCLE', 'Circle A', 'Circle B')
      RETURNING inquiry_id, evidence_state, claimant_verified, original_receipt_verified, may_change_financial_records
    `, [USER_A]);
    const inquiryRow = typedRows<{ evidence_state: string; claimant_verified: boolean; original_receipt_verified: boolean; may_change_financial_records: boolean }>(inquiry.rows)[0];
    assert.equal(inquiryRow.evidence_state, 'PENDING_EVIDENCE');
    assert.equal(inquiryRow.claimant_verified, false);
    assert.equal(inquiryRow.original_receipt_verified, false);
    assert.equal(inquiryRow.may_change_financial_records, false);
    await expectPgError(db.query(`
      INSERT INTO public.taxpay_correction_inquiries
        (requester_uid, original_reference, reason, requested_outcome)
      VALUES ($1, 'SYN-REF-002', 'Synthetic attempt to assign another owner', 'Not permitted')
    `, [USER_B]), '42501');

    await assumeIdentity(db, 'authenticated', USER_B);
    assert.equal((await db.query('SELECT proposal_id FROM public.taxpay_head_change_proposals')).rows.length, 0);
    assert.equal((await db.query('SELECT inquiry_id FROM public.taxpay_correction_inquiries')).rows.length, 0);
    const visibleDraft = await db.query('SELECT id, amount_minor, memo FROM public.taxpay_payment_drafts');
    assert.deepEqual(typedRows<{ id: string; amount_minor: number; memo: string | null }>(visibleDraft.rows), [
      { id: draftB, amount_minor: 200, memo: null },
    ]);
    const updatedDraftB = await db.query(`
      UPDATE public.taxpay_payment_drafts SET memo = $1
      WHERE id = $2 RETURNING id, amount_minor, memo
    `, ['Synthetic owner B edit', draftB]);
    assert.deepEqual(typedRows<{ id: string; amount_minor: number; memo: string }>(updatedDraftB.rows), [
      { id: draftB, amount_minor: 200, memo: 'Synthetic owner B edit' },
    ]);
    await expectPgError(db.query('UPDATE public.taxpay_head_change_proposals SET submission_reason = $1', ['change denied']), '42501');
    await expectPgError(db.query('UPDATE public.taxpay_correction_inquiries SET reason = $1', ['change denied']), '42501');

    await assumeIdentity(db, 'anon', null);
    await expectPgError(db.query('SELECT id FROM public.taxpay_payment_drafts'), '42501');
    await expectPgError(db.query('INSERT INTO public.taxpay_payment_drafts (owner_uid, purpose, category, assessment_year, amount_minor) VALUES ($1, $2, $3, $4, $5)', [USER_A, 'TAX_LIABILITY_PAYMENT', 'TAX_WITH_RETURN', '2026-27', 100]), '42501');
    await expectPgError(db.query('UPDATE public.taxpay_payment_drafts SET memo = $1 WHERE id = $2', ['anonymous edit denied', draftB]), '42501');
    await expectPgError(db.query('SELECT proposal_id FROM public.taxpay_head_change_proposals'), '42501');
    await expectPgError(db.query('SELECT inquiry_id FROM public.taxpay_correction_inquiries'), '42501');
  } finally {
    await db.close();
  }
});

Deno.test('correction submission syncs to a private Office outbox and review states read back without financial mutation', async () => {
  const db = await createDatabase();
  const ids = {
    inquiry: '80000000-0000-4000-8000-000000000001',
    maker: '80000000-0000-4000-8000-000000000011',
    reviewer: '80000000-0000-4000-8000-000000000012',
    approver: '80000000-0000-4000-8000-000000000013',
    message1: '80000000-0000-4000-8000-000000000021',
    message2: '80000000-0000-4000-8000-000000000022',
    message3: '80000000-0000-4000-8000-000000000023',
    idem1: '80000000-0000-4000-8000-000000000031',
    idem2: '80000000-0000-4000-8000-000000000032',
    idem3: '80000000-0000-4000-8000-000000000033',
  };
  const asJson = <T,>(value: unknown): T => typeof value === 'string' ? JSON.parse(value) as T : value as T;
  const command = (input: {
    messageId: string; action: string; officerUid: string; officerRole: string;
    idempotencyKey: string; expectedReviewState: string;
  }) => ({
    schemaVersion: '1.0.0', commandType: 'CORRECTION_REVIEW',
    messageId: input.messageId, requestId: ids.inquiry, origin: 'OFFICE_SQL',
    action: input.action, officerUid: input.officerUid, officerRole: input.officerRole,
    reason: 'Synthetic independent review note',
    idempotencyKey: input.idempotencyKey,
    expectedReviewState: input.expectedReviewState,
    occurredAt: '2026-10-29T17:00:00.000Z',
  });
  const record = async (value: ReturnType<typeof command>) => {
    const result = await db.query(
      'SELECT public.taxpay_correction_record_office_decision($1::jsonb) AS result',
      [JSON.stringify(value)],
    );
    return asJson<Record<string, unknown>>(typedRows<{ result: unknown }>(result.rows)[0].result);
  };

  try {
    await assumeIdentity(db, 'authenticated', USER_A);
    const inserted = await db.query(`
      INSERT INTO public.taxpay_correction_inquiries
        (requester_uid,original_reference,reason,requested_outcome,change_kind,old_value,new_value)
      VALUES ($1,'SYN-REF-003','Synthetic evidence-pending request',
        'Review this synthetic payment reference','CIRCLE','Circle A','Circle B')
      RETURNING inquiry_id,office_review_state,office_review_revision
    `, [USER_A]);
    ids.inquiry = typedRows<{ inquiry_id: string }>(inserted.rows)[0].inquiry_id;
    assert.deepEqual(typedRows<{ inquiry_id: string; office_review_state: string; office_review_revision: number }>(inserted.rows), [
      { inquiry_id: ids.inquiry, office_review_state: 'PENDING_OFFICER', office_review_revision: 1 },
    ]);
    const deniedStateWrite = db.query(
      'UPDATE public.taxpay_correction_inquiries SET office_review_state=$1 WHERE inquiry_id=$2',
      ['APPROVER_CLOSED', ids.inquiry],
    );
    await expectPgError(deniedStateWrite, '42501');

    await db.exec('RESET ROLE');
    const outbox = await db.query(`
      SELECT delivery_state,event_payload FROM payment_sync.correction_outbox WHERE inquiry_id=$1
    `, [ids.inquiry]);
    const outboxRow = typedRows<{ delivery_state: string; event_payload: Record<string, unknown> }>(outbox.rows)[0];
    assert.equal(outboxRow.delivery_state, 'PENDING');
    assert.equal(outboxRow.event_payload.originalReference, 'SYN-REF-003');
    assert.equal('requesterUid' in outboxRow.event_payload, false);
    assert.equal('taxpayerTin' in outboxRow.event_payload, false);

    await db.exec('SET ROLE service_role');
    const claimedResult = await db.query('SELECT public.taxpay_correction_internal_claim(20) AS result');
    const claimed = asJson<Array<{ claimToken: string; event: Record<string, unknown> }>>(
      typedRows<{ result: unknown }>(claimedResult.rows)[0].result,
    );
    assert.equal(claimed.length, 1);
    assert.deepEqual(claimed[0].event, {
      schemaVersion: '1.0.0', eventId: claimed[0].event.eventId,
      requestId: ids.inquiry, origin: 'TAXPAY_SQL', eventType: 'CORRECTION_SUBMITTED',
      revision: 1, occurredAt: claimed[0].event.occurredAt,
      payload: outboxRow.event_payload,
    });
    await db.query(`SELECT public.taxpay_correction_internal_ack($1,$2,true,NULL)`,
      [claimed[0].event.eventId, claimed[0].claimToken]);

    await db.exec('RESET ROLE');
    await db.exec("SET ROLE authenticated");
    await expectPgError(db.query(
      'SELECT public.taxpay_correction_record_office_decision($1::jsonb)',
      [JSON.stringify(command({messageId:ids.message1,action:'MAKER_ACKNOWLEDGE',officerUid:ids.maker,
        officerRole:'MAKER',idempotencyKey:ids.idem1,expectedReviewState:'PENDING_OFFICER'}))],
    ), '42501');
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE service_role');

    const maker = command({messageId:ids.message1,action:'MAKER_ACKNOWLEDGE',officerUid:ids.maker,
      officerRole:'MAKER',idempotencyKey:ids.idem1,expectedReviewState:'PENDING_OFFICER'});
    assert.equal((await record(maker)).reviewState, 'MAKER_ACKNOWLEDGED');
    assert.equal((await record(maker)).duplicate, true);
    await assert.rejects(record(command({messageId:'80000000-0000-4000-8000-000000000041',
      action:'REVIEWER_VERIFY',officerUid:ids.maker,officerRole:'REVIEWER',
      idempotencyKey:'80000000-0000-4000-8000-000000000042',expectedReviewState:'MAKER_ACKNOWLEDGED'})));

    const reviewer = command({messageId:ids.message2,action:'REVIEWER_VERIFY',officerUid:ids.reviewer,
      officerRole:'REVIEWER',idempotencyKey:ids.idem2,expectedReviewState:'MAKER_ACKNOWLEDGED'});
    assert.equal((await record(reviewer)).reviewState, 'REVIEWER_VERIFIED');
    const approver = command({messageId:ids.message3,action:'APPROVER_CLOSE',officerUid:ids.approver,
      officerRole:'APPROVER',idempotencyKey:ids.idem3,expectedReviewState:'REVIEWER_VERIFIED'});
    assert.equal((await record(approver)).reviewState, 'APPROVER_CLOSED');

    await db.exec('RESET ROLE');
    const finalState = await db.query(`
      SELECT office_review_state,office_review_revision,evidence_state,claimant_verified,
        original_receipt_verified,may_change_financial_records
      FROM public.taxpay_correction_inquiries WHERE inquiry_id=$1
    `, [ids.inquiry]);
    assert.deepEqual(typedRows<Record<string, unknown>>(finalState.rows), [{
      office_review_state: 'APPROVER_CLOSED',office_review_revision:4,
      evidence_state:'PENDING_EVIDENCE',claimant_verified:false,
      original_receipt_verified:false,may_change_financial_records:false,
    }]);
    assert.equal((await db.query(
      'SELECT count(*) AS count FROM public.taxpay_correction_review_decisions WHERE inquiry_id=$1',
      [ids.inquiry],
    )).rows[0].count, 3);
  } finally {
    await db.close();
  }
});
