\set ON_ERROR_STOP on
-- Disposable database only. Proves anon blocked and authorized CMS writes function.
begin;
do $assert$
begin
  if has_table_privilege('anon','public.taxpay_site_banners','INSERT')
    or has_table_privilege('anon','public.taxpay_site_banners','UPDATE')
    or has_table_privilege('anon','public.taxpay_site_banners','DELETE')
    or has_table_privilege('anon','public.taxpay_site_logo','UPDATE')
  then raise exception 'FAIL: anonymous CMS table write privileges remain'; end if;
  if has_function_privilege('anon','public.taxpay_set_banner_position(text,integer)','EXECUTE')
  then raise exception 'FAIL: anonymous banner order RPC remains'; end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
       and cmd='INSERT' and 'anon'=any(roles)
       and (qual like '%taxpay-banners%' or with_check like '%taxpay-banners%'
            or qual like '%taxpay-branding%' or with_check like '%taxpay-branding%'))
  then raise exception 'FAIL: anonymous CMS upload policy remains'; end if;
end;
$assert$;

-- Existing verified-admin fixture provisions only email-confirmed approved identity.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
values(gen_random_uuid(),'00000000-0000-0000-0000-000000000000',
       'authenticated','authenticated','shihabshajib01@gmail.com',now(),now(),now())
returning id as cms_uid \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cms_uid', true);
do $assert$
begin
  if not (select public.taxpay_is_verified_portal_admin()) then
    raise exception 'FAIL: approved verified admin identity unavailable'; end if;
end;
$assert$;
update public.taxpay_site_banners set updated_by = (select auth.uid()),heading_en=heading_en
 where id=(select id from public.taxpay_site_banners order by sort_order,id limit 1);
update public.taxpay_site_logo set image_path=image_path where id='primary';
select public.taxpay_set_banner_position(
   (select id from public.taxpay_site_banners order by sort_order,id limit 1),1);
rollback;
\echo 'PASS: anonymous CMS writes denied; synthetic verified administrator writes succeed; all fixture changes rolled back';
