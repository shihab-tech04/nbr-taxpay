import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/** An e-TIN associated with an Auth account by a trusted, server-side process.
 * Auth user metadata and public demo profiles are NOT evidence of TIN ownership.
 */
export interface AccountTaxpayerProfile {
  ownerUid: string;
  tin: string;
  nameEn: string;
  nameBn: string | null;
  receiptMobile: string | null;
  taxZone: string | null;
  taxCircle: string | null;
}

type ProfileState = {
  userId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  profile: AccountTaxpayerProfile | null;
};

export function useAccountTaxpayerProfile(userId: string | null): ProfileState {
  const [snapshot, setSnapshot] = useState<ProfileState>({ userId: null, status: 'idle', profile: null });

  useEffect(() => {
    if (!userId) {
      setSnapshot({ userId: null, status: 'idle', profile: null });
      return;
    }
    const client = supabase;
    if (!client) {
      setSnapshot({ userId, status: 'error', profile: null });
      return;
    }
    let active = true;
    setSnapshot({ userId, status: 'loading', profile: null });

    (async () => {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error('Account session changed');
      const { data, error } = await client.from('taxpay_verified_taxpayer_profiles')
        .select('owner_uid,tin,name_en,name_bn,receipt_mobile,tax_zone,tax_circle')
        .eq('owner_uid', userId).maybeSingle();
      if (error) throw error;
      const { data: current, error: currentError } = await client.auth.getUser();
      if (currentError || current.user?.id !== userId) throw new Error('Account session changed');
      if (!active) return;
      const valid = data && data.owner_uid === userId && /^\d{12}$/.test(data.tin) &&
        typeof data.name_en === 'string' && Boolean(data.name_en.trim());
      setSnapshot({
        userId, status: 'ready',
        profile: valid ? {
          ownerUid: data.owner_uid, tin: data.tin, nameEn: data.name_en,
          nameBn: data.name_bn, receiptMobile: data.receipt_mobile,
          taxZone: data.tax_zone, taxCircle: data.tax_circle,
        } : null,
      });
    })().catch(() => {
      if (active) setSnapshot({ userId, status: 'error', profile: null });
    });
    return () => { active = false; };
  }, [userId]);

  // Do not briefly show a previous account's identity on an account switch.
  return snapshot.userId === userId ? snapshot : {
    userId, status: userId ? 'loading' : 'idle', profile: null,
  };
}
