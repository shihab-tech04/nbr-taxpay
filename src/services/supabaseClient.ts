import { createClient } from '@supabase/supabase-js';

import { TAXPAY_PUBLIC_ENDPOINT } from '../config/publicBackend';

const url = TAXPAY_PUBLIC_ENDPOINT.url;
const key = TAXPAY_PUBLIC_ENDPOINT.publishableKey;

// An unset configuration must fail closed, never silently switch to mock user data.
// This key is publishable, not a server/secret/service-role key.
export const supabase = url && key
  ? createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } })
  : null;

export const backendConfigured = Boolean(supabase);
