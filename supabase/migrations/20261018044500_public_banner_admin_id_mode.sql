-- Requested temporary Office login model: user ID 'admin' alone controls the
-- Content Management UI. There is no server-verifiable login credential.
-- Consequently these *banner-only* privileges are publicly accessible.
-- Do not copy this policy pattern to taxpayer, payments, or officer records.
grant select, update, delete on public.taxpay_site_banners to anon;

drop policy if exists "office id only reads banner drafts" on public.taxpay_site_banners;
create policy "office id only reads banner drafts"
on public.taxpay_site_banners for select to anon using (true);

drop policy if exists "office id only edits banners" on public.taxpay_site_banners;
create policy "office id only edits banners"
on public.taxpay_site_banners for update to anon
using (true) with check (updated_by is null);

drop policy if exists "office id only removes banners" on public.taxpay_site_banners;
create policy "office id only removes banners"
on public.taxpay_site_banners for delete to anon using (true);

drop policy if exists "office id only uploads banner images" on storage.objects;
create policy "office id only uploads banner images"
on storage.objects for insert to anon
with check (bucket_id = 'taxpay-banners');
