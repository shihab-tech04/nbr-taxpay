-- TaxPay banner/logo least-privilege and existing logo replacement recovery.
-- Keep approved public SELECT, authenticated CMS RLS and payment data unchanged.
revoke truncate, trigger, references
  on table public.taxpay_site_banners, public.taxpay_site_logo
  from anon, authenticated;

-- Match the already-existing verified-admin logo INSERT policy. Allow only
-- this same authorized CMS identity to clean up uniquely named replaced files.
drop policy if exists "verified administrator removes superseded site logos"
  on storage.objects;
create policy "verified administrator removes superseded site logos"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'taxpay-branding'
    and name ~ '^logos/[a-f0-9-]{36}\.(png|jpg|jpeg)$'
    and (select public.taxpay_is_verified_portal_admin())
  );
