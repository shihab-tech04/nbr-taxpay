import { useEffect, useState } from 'react';
import { getDemoUser, type DemoUser } from '../data/demoUsers';
import { supabase } from './supabaseClient';

/** The payment form's fictional identity, never an issued or verified e-TIN. */
export type PaymentAccountProfile = {
  tin: string;
  nameEn: string;
  nameBn: string;
  receiptMobile: string;
  taxZone: string;
  taxCircle: string;
};

function toPaymentProfile(user: DemoUser): PaymentAccountProfile {
  const sequence = Number(user.id.slice(4));
  return {
    tin: user.tin,
    nameEn: user.nameEn,
    nameBn: user.nameBn,
    // Clearly synthetic contact/jurisdiction data, scoped to the ten previews.
    receiptMobile: `017${String(sequence).padStart(8, '0')}`,
    taxZone: `Taxes Zone ${sequence}`,
    taxCircle: user.taxCircle,
  };
}

type Snapshot = { userId: string | null; status: 'idle' | 'loading' | 'ready' | 'unlinked'; profile: PaymentAccountProfile | null };

/**
 * Preview credentials select a browser-local fixture. A real Supabase Auth
 * account must instead have an approved sim_payment_account_bindings row;
 * public demo data or editable Auth metadata may never establish that binding.
 */
export function usePaymentAccountProfile(authUid: string | null, previewAccount: DemoUser | null): Snapshot {
  const [snapshot, setSnapshot] = useState<Snapshot>({ userId: null, status: 'idle', profile: null });
  useEffect(() => {
    if (authUid) {
      const client = supabase;
      if (!client) {
        setSnapshot({ userId: authUid, status: 'unlinked', profile: null });
        return;
      }
      let active = true;
      setSnapshot({ userId: authUid, status: 'loading', profile: null });
      (async () => {
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || auth.user?.id !== authUid) throw new Error('Account session changed');
        const { data: boundId, error } = await client.rpc('sim_my_taxpayer_profile');
        if (error) throw error;
        const { data: current, error: currentError } = await client.auth.getUser();
        if (currentError || current.user?.id !== authUid) throw new Error('Account session changed');
        if (!active) return;
        const matched = getDemoUser(boundId);
        setSnapshot({ userId: authUid, status: matched ? 'ready' : 'unlinked', profile: matched ? toPaymentProfile(matched) : null });
      })().catch(() => {
        if (active) setSnapshot({ userId: authUid, status: 'unlinked', profile: null });
      });
      return () => { active = false; };
    }
  }, [authUid]);

  // Preview profile is immediately available from the signed-in local fixture;
  // no blank loading frame or asynchronous identity reset is needed.
  if (!authUid) return previewAccount
    ? { userId: previewAccount.id, status: 'ready', profile: toPaymentProfile(previewAccount) }
    : { userId: null, status: 'idle', profile: null };
  return snapshot.userId === authUid ? snapshot : {
    userId: authUid, status: 'loading', profile: null,
  };
}
