import { supabase } from './supabaseClient';
import { activePreviewSession } from './previewAccountSession';
import { unsignedGuestPaymentDraftRequest } from './guestBeneficiaries';
import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';

const services = [
  'TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
  'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT', 'TRAVEL_TAX',
] as const;

export type PaymentDraftService = typeof services[number];
export type PaymentDraftActor =
  | { kind: 'authenticated'; userId: string }
  | { kind: 'preview'; profileId: string }
  | { kind: 'guest' };

export type PaymentFormDraft = {
  id: string;
  service: PaymentDraftService;
  form_payload: Record<string, unknown>;
  revision: number;
  created_at: string;
  updated_at: string;
};

export class PaymentDraftConflictError extends Error {
  constructor() { super('The saved draft was changed in another session. Reload the draft before updating.'); }
}

export function isPaymentDraftService(service: string): service is PaymentDraftService {
  return services.some(item => item === service);
}

export function checkFormDraftPayload(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid payment form draft.');
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 48_000 || Object.hasOwn(value, '__proto__')) {
    throw new Error('Payment form draft exceeds the safe data limit.');
  }
}

function validRecord(value: unknown): PaymentFormDraft {
  if (!value || typeof value !== 'object') throw new Error('Draft record could not be verified.');
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.service !== 'string' ||
      !isPaymentDraftService(row.service) || !Number.isSafeInteger(row.revision) ||
      Number(row.revision) < 1 || typeof row.created_at !== 'string' ||
      typeof row.updated_at !== 'string') throw new Error('Draft metadata could not be verified.');
  checkFormDraftPayload(row.form_payload);
  return row as PaymentFormDraft;
}

async function verifiedActor(actor: PaymentDraftActor) {
  if (actor.kind === 'preview') {
    const session = activePreviewSession();
    if (!session || session.profileId !== actor.profileId) throw new Error('Sign in to your account again.');
    return { capability: session.capability, profileId: session.profileId };
  }
  if (actor.kind === 'guest') {
    if (activePreviewSession()) throw new Error('Sign out of the preview account to use guest drafts.');
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) throw new Error('Sign out of the account to use guest drafts.');
    }
    return { capability: null, profileId: null };
  }
  if (!supabase) throw new Error('Database is unavailable.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || data.user.id !== actor.userId)
    throw new Error('Sign in to your account again.');
  return { capability: null, profileId: null };
}

async function checkActorStillSignedIn(actor: PaymentDraftActor) {
  await verifiedActor(actor);
}

async function previewDraftAction(
  actor: PaymentDraftActor & { kind: 'preview' },
  action: 'list' | 'get' | 'create' | 'update' | 'delete',
  fields: Record<string, unknown>,
): Promise<unknown> {
  const identity = await verifiedActor(actor);
  const { url, publishableKey } = TAXPAY_PUBLIC_ENDPOINT;
  if (!url || !publishableKey || !identity.capability) throw new Error('Draft storage is unavailable.');
  const response = await fetch(url.replace(/\/$/, '') + '/functions/v1/taxpay-guest-beneficiaries', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      apikey: publishableKey,
      'x-taxpay-guest-capability': identity.capability,
    },
    body: JSON.stringify({ action: 'payment-draft-' + action, ...fields }),
  });
  const body: unknown = await response.json().catch(() => null);
  const result = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (!response.ok || result?.success !== true) {
    if (response.status === 409) throw new PaymentDraftConflictError();
    if (response.status === 401 || response.status === 403) throw new Error('Sign in to your account again.');
    throw new Error('Draft storage is unavailable. No save was confirmed.');
  }
  await checkActorStillSignedIn(actor);
  return result?.data;
}

async function unsignedGuestDraftAction(
  actor: PaymentDraftActor & {kind:'guest'},
  action: 'list'|'get'|'create'|'update'|'delete',
  fields: Record<string,unknown> = {},
): Promise<unknown> {
  await verifiedActor(actor);
  const result = await unsignedGuestPaymentDraftRequest<unknown>(action,fields);
  await checkActorStillSignedIn(actor);
  return result;
}

async function authenticatedRows(actor: PaymentDraftActor & {kind: 'authenticated'}, service?: PaymentDraftService) {
  await verifiedActor(actor);
  if (!supabase) throw new Error('Database is unavailable.');
  let query = supabase.from('taxpay_account_payment_form_drafts')
    .select('id,service,form_payload,revision,created_at,updated_at')
    .eq('owner_uid', actor.userId);
  if (service) query = query.eq('service', service);
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load drafts.');
  await checkActorStillSignedIn(actor);
  return data ?? [];
}

export async function listPaymentFormDrafts(actor: PaymentDraftActor, service?: PaymentDraftService): Promise<PaymentFormDraft[]> {
  const values = actor.kind === 'preview'
    ? await previewDraftAction(actor, 'list', { service: service ?? null })
    : actor.kind === 'guest'
      ? await unsignedGuestDraftAction(actor, 'list', { service: service ?? null })
      : await authenticatedRows(actor, service);
  if (!Array.isArray(values)) throw new Error('Draft list could not be verified.');
  return values.map(validRecord).filter(item => !service || item.service === service);
}

async function readBackDraft(actor: PaymentDraftActor, id: string): Promise<PaymentFormDraft> {
  if (actor.kind === 'preview') {
    return validRecord(await previewDraftAction(actor, 'get', { id }));
  }
  if (actor.kind === 'guest') {
    return validRecord(await unsignedGuestDraftAction(actor, 'get', { id }));
  }
  await verifiedActor(actor);
  if (!supabase) throw new Error('Database is unavailable.');
  const { data, error } = await supabase.from('taxpay_account_payment_form_drafts')
    .select('id,service,form_payload,revision,created_at,updated_at')
    .eq('id', id).eq('owner_uid', actor.userId).single();
  if (error || !data) throw new Error('Saved draft could not be read back.');
  await checkActorStillSignedIn(actor);
  return validRecord(data);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return '{' + Object.keys(v).sort().map(key => JSON.stringify(key) + ':' + canonical(v[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export async function savePaymentFormDraft(
  actor: PaymentDraftActor, service: PaymentDraftService,
  payload: Record<string, unknown>, previous?: PaymentFormDraft,
): Promise<PaymentFormDraft> {
  checkFormDraftPayload(payload);
  if (!isPaymentDraftService(service) || (previous && previous.service !== service))
    throw new Error('Draft service changed.');
  await verifiedActor(actor);
  let result: PaymentFormDraft;
  if (actor.kind === 'guest') {
    const data = await unsignedGuestDraftAction(actor, previous ? 'update' : 'create', {
      id: previous?.id ?? null, revision: previous?.revision ?? null, service,
      payload,
    });
    result = validRecord(data);
  } else if (actor.kind === 'preview') {
    const data = await previewDraftAction(actor, previous ? 'update' : 'create', {
      id: previous?.id ?? null, revision: previous?.revision ?? null, service,
      payload,
    });
    result = validRecord(data);
  } else {
    if (!supabase) throw new Error('Database is unavailable.');
    if (previous) {
      const { data, error } = await supabase.from('taxpay_account_payment_form_drafts')
        .update({ form_payload: payload })
        .eq('id', previous.id).eq('owner_uid', actor.userId)
        .eq('service', service).eq('revision', previous.revision)
        .select('id,service,form_payload,revision,created_at,updated_at');
      if (error) throw new Error('Could not update draft.');
      if (!data || data.length !== 1) throw new PaymentDraftConflictError();
      result = validRecord(data[0]);
    } else {
      const { data, error } = await supabase.from('taxpay_account_payment_form_drafts')
        .insert({ owner_uid: actor.userId, service, form_payload: payload })
        .select('id,service,form_payload,revision,created_at,updated_at');
      if (error) throw new Error('Could not save draft.');
      if (!data || data.length !== 1) throw new Error('Draft save was not confirmed.');
      result = validRecord(data[0]);
    }
  }
  const reread = await readBackDraft(actor, result.id);
  if (reread.revision !== result.revision || reread.service !== service ||
      canonical(reread.form_payload) !== canonical(payload)) {
    throw new Error('Draft readback did not match the submitted form.');
  }
  return reread;
}

export async function deletePaymentFormDraft(actor: PaymentDraftActor, draft: PaymentFormDraft): Promise<void> {
  await verifiedActor(actor);
  if (actor.kind === 'guest' || actor.kind === 'preview') {
    const result = actor.kind === 'guest'
      ? await unsignedGuestDraftAction(actor, 'delete', { id: draft.id, revision: draft.revision })
      : await previewDraftAction(actor, 'delete', { id: draft.id, revision: draft.revision });
    if (!result || typeof result !== 'object' || (result as Record<string, unknown>).deleted !== draft.id)
      throw new Error('Draft deletion was not confirmed.');
  } else {
    if (!supabase) throw new Error('Database is unavailable.');
    const { data, error } = await supabase.from('taxpay_account_payment_form_drafts')
      .delete().eq('id', draft.id).eq('owner_uid', actor.userId)
      .eq('revision', draft.revision).select('id');
    if (error) throw new Error('Could not delete draft.');
    if (!data || data.length !== 1 || data[0]?.id !== draft.id)
      throw new PaymentDraftConflictError();
  }
  const remaining = await listPaymentFormDrafts(actor, draft.service);
  if (remaining.some(row => row.id === draft.id)) throw new Error('Draft deletion was not confirmed by SQL.');
}
