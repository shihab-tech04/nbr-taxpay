-- P0: remove unauthenticated CMS authoring. Use only with Office PR #121.
-- Precondition: current published banner/logo snapshots and role/policy definitions backed up.
-- Safety: RLS-backed verified portal administrators retain write permission; public reads stay.
begin;

-- Historical ID-only Office publishing routes allowed anonymous database changes.
drop policy if exists "office id only adds banners" on public.taxpay_site_banners;
drop policy if exists "office id only edits banners" on public.taxpay_site_banners;
drop policy if exists "office id only reads banner drafts" on public.taxpay_site_banners;
drop policy if exists "office id only removes banners" on public.taxpay_site_banners;
revoke insert, update, delete on public.taxpay_site_banners from anon;

drop policy if exists "Office ID-only editor updates the site logo" on public.taxpay_site_logo;
revoke update on public.taxpay_site_logo from anon;
drop policy if exists "verified administrator updates site logo" on public.taxpay_site_logo;
create policy "verified administrator updates site logo"
  on public.taxpay_site_logo for update to authenticated
  using (id = 'primary' and (select public.taxpay_is_verified_portal_admin()))
  with check (id = 'primary' and (select public.taxpay_is_verified_portal_admin()));

drop policy if exists "office id only uploads banner images" on storage.objects;
drop policy if exists "Office ID-only editor uploads site logos" on storage.objects;
drop policy if exists "verified administrator uploads site logos" on storage.objects;
create policy "verified administrator uploads site logos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'taxpay-branding'
    and (select public.taxpay_is_verified_portal_admin())
    and name ~ '^logos/[a-f0-9-]{36}\.(png|jpg|jpeg)$'
  );

-- Keep banner ordering SECURITY INVOKER and compatible with the existing
-- verified-admin row policies, which require updated_by = auth.uid().
create or replace function public.taxpay_set_banner_position(
  p_banner_id text, p_position integer
) returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  all_ids text[];
  other_ids text[];
  ordered_ids text[] := array[]::text[];
  total_count integer;
  new_position integer;
  i integer;
begin
  if not (select public.taxpay_is_verified_portal_admin()) then
    raise exception 'VERIFIED_CMS_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(58007001);
  select array_agg(id order by sort_order,id) into all_ids from public.taxpay_site_banners;
  if all_ids is null or not p_banner_id = any(all_ids) then
    raise exception 'Banner not found.';
  end if;
  total_count := cardinality(all_ids);
  new_position := greatest(1,least(coalesce(p_position,total_count),total_count));
  other_ids := array_remove(all_ids,p_banner_id);
  for i in 1..total_count loop
    if i = new_position then ordered_ids := array_append(ordered_ids,p_banner_id);
    elsif i < new_position then ordered_ids := array_append(ordered_ids,other_ids[i]);
    else ordered_ids := array_append(ordered_ids,other_ids[i-1]);
    end if;
  end loop;
  for i in 1..total_count loop
    update public.taxpay_site_banners
       set sort_order = i-1, updated_by = (select auth.uid())
     where id = ordered_ids[i] and sort_order is distinct from i-1;
  end loop;
end;
$function$;
revoke execute on function public.taxpay_set_banner_position(text,integer)
  from public, anon;
grant execute on function public.taxpay_set_banner_position(text,integer)
  to authenticated;

-- Fail before commit if the public role still has CMS DML access.
do $assert$
begin
  if has_table_privilege('anon','public.taxpay_site_banners','INSERT')
     or has_table_privilege('anon','public.taxpay_site_banners','UPDATE')
     or has_table_privilege('anon','public.taxpay_site_banners','DELETE')
     or has_table_privilege('anon','public.taxpay_site_logo','UPDATE')
     or has_function_privilege('anon','public.taxpay_set_banner_position(text,integer)','EXECUTE')
  then raise exception 'P0_CMS_ANONYMOUS_WRITE_STILL_GRANTED'; end if;
  if not has_table_privilege('authenticated','public.taxpay_site_banners','UPDATE')
     or not has_table_privilege('authenticated','public.taxpay_site_logo','UPDATE')
  then raise exception 'VERIFIED_ADMIN_WRITE_GRANTS_MISSING'; end if;
end;
$assert$;
commit;
