-- Verified Office CMS asset cleanup requires both SELECT and DELETE
-- on Storage metadata. Keep the scope to only the two existing CMS buckets
-- and the established verified portal-admin role. Do not expose private
-- metadata to anonymous visitors or alter bucket public file delivery.
drop policy if exists "verified administrator reads CMS asset metadata"
  on storage.objects;
create policy "verified administrator reads CMS asset metadata"
  on storage.objects
  for select to authenticated
  using (
    bucket_id in ('taxpay-banners', 'taxpay-branding')
    and (select public.taxpay_is_verified_portal_admin())
  );
