-- Repair the server-only TaxPay CMS bridge permissions (PostgREST 42501).
-- The Office-authenticated Edge Function independently verifies the Office
-- publisher before making these TaxPay writes using a server-side secret.
-- Never grant these write privileges to anon or general authenticated users.
--
-- Public reading and existing RLS remain unchanged. Image storage access
-- remains governed by its existing server key and Storage policies.
-- Grants are idempotent and match the API operations performed by
-- supabase/functions/office-cms-publish/index.ts.

GRANT SELECT, UPDATE
  ON TABLE public.taxpay_site_logo
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.taxpay_site_banners
  TO service_role;
