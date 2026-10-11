-- Applied to TaxPay Supabase project eyqhoavnitkrajvyqvxn on 2026-10-10.
-- Prevent direct anonymous/authenticated RPC calls to the auto-RLS DDL helper.
-- Its trusted table-creation trigger remains available.
-- A clean local database may not have the project-specific helper provisioned.
-- Preserve the permission restriction whenever that helper exists.
DO $migration$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END
$migration$;
