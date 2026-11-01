-- Applied on hosted Supabase Tax Payer Payment project as migration 20261101070634.
-- Identical operation to local migration; retain for deployment/SQL traceability. Do not replay manually.
-- One transactional, RLS-enforced banner save + reorder command for the verified Office CMS.
-- Preserves anonymous published reads and the approved frozen TaxPay hero layout.
create or replace function public.taxpay_save_banner(
  p_banner jsonb,
  p_expected_version bigint default null,
  p_position integer default null
) returns public.taxpay_site_banners
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id text;
  v_previous public.taxpay_site_banners%rowtype;
  v_saved public.taxpay_site_banners%rowtype;
begin
  if not (select public.taxpay_is_verified_portal_admin()) then
    raise exception 'VERIFIED_CMS_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_banner is null or jsonb_typeof(p_banner) <> 'object' then
    raise exception 'Invalid banner payload.';
  end if;
  v_id := p_banner->>'id';
  if v_id is null or v_id !~ '^[a-z][a-z0-9_-]{0,39}$' then
    raise exception 'Invalid banner ID.';
  end if;
  perform pg_advisory_xact_lock(58007001);
  select * into v_previous from public.taxpay_site_banners where id=v_id for update;
  if found then
    if p_expected_version is distinct from v_previous.version then
      raise exception 'BANNER_VERSION_CONFLICT' using errcode = '40001';
    end if;
    update public.taxpay_site_banners set
      service_code = nullif(p_banner->>'service_code',''),
      heading_en = p_banner->>'heading_en',
      heading_bn = p_banner->>'heading_bn',
      description_en = p_banner->>'description_en',
      description_bn = p_banner->>'description_bn',
      mobile_heading_en = p_banner->>'mobile_heading_en',
      mobile_heading_bn = p_banner->>'mobile_heading_bn',
      mobile_description_en = p_banner->>'mobile_description_en',
      mobile_description_bn = p_banner->>'mobile_description_bn',
      action_en = p_banner->>'action_en',
      action_bn = p_banner->>'action_bn',
      desktop_image_path = p_banner->>'desktop_image_path',
      mobile_image_path = p_banner->>'mobile_image_path',
      published = (p_banner->>'published')::boolean,
      updated_by = (select auth.uid())
    where id = v_id
    returning * into v_saved;
  else
    if p_expected_version is not null then
      raise exception 'BANNER_VERSION_CONFLICT' using errcode = '40001';
    end if;
    insert into public.taxpay_site_banners
      (id, service_code, heading_en, heading_bn, description_en, description_bn,
       mobile_heading_en, mobile_heading_bn, mobile_description_en, mobile_description_bn,
       action_en, action_bn, desktop_image_path, mobile_image_path,
       published, sort_order, updated_by)
    values
      (v_id, nullif(p_banner->>'service_code',''),
       p_banner->>'heading_en',p_banner->>'heading_bn',
       p_banner->>'description_en',p_banner->>'description_bn',
       p_banner->>'mobile_heading_en',p_banner->>'mobile_heading_bn',
       p_banner->>'mobile_description_en',p_banner->>'mobile_description_bn',
       p_banner->>'action_en',p_banner->>'action_bn',
       p_banner->>'desktop_image_path',p_banner->>'mobile_image_path',
       (p_banner->>'published')::boolean,
       (select coalesce(max(sort_order),-1)+1 from public.taxpay_site_banners),
       (select auth.uid()))
    returning * into v_saved;
  end if;
  if v_saved.id is null then
    raise exception 'Banner write was not authorized.' using errcode = '42501';
  end if;
  perform public.taxpay_set_banner_position(v_id,coalesce(p_position,1));
  select * into v_saved from public.taxpay_site_banners where id=v_id;
  return v_saved;
end
$$;
revoke all on function public.taxpay_save_banner(jsonb,bigint,integer) from public,anon;
grant execute on function public.taxpay_save_banner(jsonb,bigint,integer) to authenticated;

-- Realtime emits banner table changes; RLS still gates unpublished rows.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='taxpay_site_banners'
  ) then
    alter publication supabase_realtime add table public.taxpay_site_banners;
  end if;
end
$$;