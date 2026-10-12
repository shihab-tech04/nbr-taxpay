import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/**
 * Application Auth identity ONLY. Never infer eTIN ownership, NBR taxpayer
 * privileges, payment/ledger rights or financial entitlements from this user.
 */
export function useAccountIdentity() {
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

/** Logout is a local-session Auth operation, not a demo role-switch. */
export async function signOutApplicationAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Authentication is not configured.' };
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? { ok: false, error: error.message } : { ok: true };
}
