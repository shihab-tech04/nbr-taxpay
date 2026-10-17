import { useEffect, useState } from 'react';
import type { DemoUserId } from '../data/demoUsers';
import { supabase } from './supabaseClient';

/** Publicly inspectable, fictional records. These types convey no tax-credit entitlement. */
export const DEMO_SERVICE_CODES = [
  'TAX_WITH_RETURN',
  'ADVANCE_TAX',
  'ASSESSED_DEMAND',
  'PENALTY',
  'SOURCE_TAX_DEPOSIT',
  'APPELLATE_TRIBUNAL',
  'OTHER_TAX_PAYMENT',
  'TRAVEL_TAX',
] as const;

export type DemoServiceCode = typeof DEMO_SERVICE_CODES[number];
export type DemoServiceRecordState = 'SIMULATED' | 'PENDING' | 'FAILED' | 'REVERSED' | 'REVIEW_REQUIRED';
export type DemoServiceParticipantRole = 'PAYER' | 'BENEFICIARY';

export interface DemoSqlUserProfile {
  id: DemoUserId;
  roleCode: string;
  nameEn: string | null;
  nameBn: string | null;
  focusEn: string | null;
  focusBn: string | null;
  tinStub: string | null;
  jurisdictionLabel: string | null;
}

export interface DemoSqlServiceRecord {
  recordId: string;
  userId: DemoUserId;
  serviceCode: DemoServiceCode;
  assessmentYear: string | null;
  amountMinor: number;
  state: DemoServiceRecordState;
  participantRole: DemoServiceParticipantRole;
  relatedUserId: DemoUserId | null;
  recordedAt: string;
  simulationOnly: true;
}

export interface DemoSqlProfileData {
  profile: DemoSqlUserProfile | null;
  records: DemoSqlServiceRecord[];
}

const validUserId = (value: unknown): value is DemoUserId =>
  typeof value === 'string' && /^user(?:10|[1-9])$/.test(value);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid stored ${field}`);
  return value;
};
const nullableText = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`Invalid stored ${field}`);
  return value.trim() ? value : null;
};
const validService = (value: unknown): value is DemoServiceCode =>
  typeof value === 'string' && (DEMO_SERVICE_CODES as readonly string[]).includes(value);
const validState = (value: unknown): value is DemoServiceRecordState =>
  value === 'SIMULATED' || value === 'PENDING' || value === 'FAILED' || value === 'REVERSED' || value === 'REVIEW_REQUIRED';

const parseProfile = (raw: unknown, requestedId: DemoUserId): DemoSqlUserProfile => {
  if (!isObject(raw) || raw.id !== requestedId) throw new Error('Unexpected stored taxpayer profile');
  return {
    id: requestedId,
    roleCode: requiredText(raw.role_code, 'profile type'),
    nameEn: nullableText(raw.name_en, 'English name'),
    nameBn: nullableText(raw.name_bn, 'Bangla name'),
    focusEn: nullableText(raw.focus_en, 'English profile focus'),
    focusBn: nullableText(raw.focus_bn, 'Bangla profile focus'),
    tinStub: nullableText(raw.tin_stub, 'TIN reference'),
    jurisdictionLabel: nullableText(raw.jurisdiction_label, 'jurisdiction'),
  };
};

const parseRecord = (raw: unknown, requestedId: DemoUserId): DemoSqlServiceRecord => {
  if (!isObject(raw) || raw.user_id !== requestedId) throw new Error('Unexpected stored service owner');
  if (!validService(raw.service_code)) throw new Error('Unsupported stored tax service');
  if (!validState(raw.record_state)) throw new Error('Unsupported stored service state');
  if (raw.participant_role !== 'PAYER' && raw.participant_role !== 'BENEFICIARY') {
    throw new Error('Unsupported stored participant role');
  }
  if (raw.related_user_id != null && !validUserId(raw.related_user_id)) {
    throw new Error('Unexpected stored related user');
  }
  if (raw.simulation_only !== true) throw new Error('Unrecognized service evidence type');
  const amountMinor = typeof raw.amount_minor === 'number' || typeof raw.amount_minor === 'string'
    ? Number(raw.amount_minor) : NaN;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Invalid or imprecise stored amount');
  }
  const recordedAt = requiredText(raw.recorded_at, 'recorded date');
  if (!Number.isFinite(Date.parse(recordedAt))) throw new Error('Invalid stored service date');

  return {
    recordId: requiredText(raw.record_id, 'record reference'),
    userId: requestedId,
    serviceCode: raw.service_code,
    assessmentYear: nullableText(raw.assessment_year, 'assessment year'),
    amountMinor,
    state: raw.record_state,
    participantRole: raw.participant_role,
    relatedUserId: raw.related_user_id ?? null,
    recordedAt,
    simulationOnly: true,
  };
};

/** Read-only SQL source for one of the ten public fictional scenarios. */
export async function loadDemoSqlProfileAndServiceRecords(userId: DemoUserId): Promise<DemoSqlProfileData> {
  if (!validUserId(userId)) throw new Error('Unknown scenario account');
  if (!supabase) throw new Error('Tax service database connection is not configured');

  const [profileResult, recordsResult] = await Promise.all([
    supabase.from('sim_payment_users')
      .select('id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label')
      .eq('id', userId).maybeSingle(),
    supabase.from('sim_tax_service_records')
      .select('record_id,user_id,service_code,assessment_year,amount_minor,record_state,participant_role,related_user_id,recorded_at,simulation_only')
      .eq('user_id', userId).order('recorded_at', { ascending: false }),
  ]);
  if (profileResult.error) throw new Error(`Profile database read failed: ${profileResult.error.message}`);
  if (recordsResult.error) throw new Error(`Service database read failed: ${recordsResult.error.message}`);

  const profile = profileResult.data ? parseProfile(profileResult.data, userId) : null;
  const records = (recordsResult.data ?? []).map(row => parseRecord(row, userId));
  if (!profile && records.length) throw new Error('Orphaned service records for this account');
  return { profile, records };
}

export type DemoSqlLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type Snapshot = {
  userId: DemoUserId | null;
  status: DemoSqlLoadStatus;
  profile: DemoSqlUserProfile | null;
  records: DemoSqlServiceRecord[];
  error: string | null;
};

/** Changing users never briefly exposes the previous user's records. */
export function useDemoSqlProfileAndServiceRecords(userId: DemoUserId | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    userId: null, status: 'idle', profile: null, records: [], error: null,
  });

  useEffect(() => {
    if (!userId) {
      setSnapshot({ userId: null, status: 'idle', profile: null, records: [], error: null });
      return;
    }
    let active = true;
    setSnapshot({ userId, status: 'loading', profile: null, records: [], error: null });
    loadDemoSqlProfileAndServiceRecords(userId).then(({ profile, records }) => {
      if (active) setSnapshot({ userId, status: 'ready', profile, records, error: null });
    }).catch(error => {
      if (active) setSnapshot({
        userId, status: 'error', profile: null, records: [],
        error: error instanceof Error ? error.message : 'Unable to read service records',
      });
    });
    return () => { active = false; };
  }, [userId]);

  return snapshot.userId === userId
    ? snapshot
    : { userId, status: userId ? 'loading' as const : 'idle' as const,
        profile: null, records: [], error: null };
}
