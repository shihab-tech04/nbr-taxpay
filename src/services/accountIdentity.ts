import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import {flushAccountViewPreferences} from './accountViewPreferences';

/**
 * Application Auth identity ONLY. Never infer eTIN ownership, NBR taxpayer
 * privileges, payment/ledger rights or financial entitlements from this user.
 */
function useResolvedAccountIdentity() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let active = true;
    let revision = 0;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      revision++;
      if (active) { setUser(session?.user ?? null); setLoading(false); }
    });
    const initialRevision = revision;
    client.auth.getUser().then(({ data: result, error }) => {
      if (active && revision === initialRevision) {
        setUser(error ? null : result.user);
        setLoading(false);
      }
    }).catch(() => {
      if (active && revision === initialRevision) {
        setUser(null);
        setLoading(false);
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  return { user, loading };
}

/** One authoritative Auth subscription for the entire TaxPay app.
 * Independent per-screen subscriptions could briefly disagree after sign-in,
 * showing account navigation without a working Sign out control.
 */
type ApplicationIdentity = ReturnType<typeof useResolvedAccountIdentity>;
const IdentityContext = createContext<ApplicationIdentity | null>(null);

export function AccountIdentityProvider({children}:{children:ReactNode}) {
  const identity = useResolvedAccountIdentity();
  return createElement(IdentityContext.Provider,{value:identity},children);
}

export function useAccountIdentity():ApplicationIdentity {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error('Account identity must be read within AccountIdentityProvider');
  return identity;
}

/** Logout is a local-session Auth operation, not a demo role-switch. */
export async function signOutApplicationAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' };
  // A user can switch to Bangla and immediately sign out. Finish that pending
  // owner-scoped preference write before the Auth token is invalidated.
  // Never block logout if a non-critical preference save itself failed.
  const {data:current}=await supabase.auth.getUser();
  if(current.user)await flushAccountViewPreferences(current.user.id).catch(()=>undefined);
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? { ok: false, error: error.message } : { ok: true };
}
