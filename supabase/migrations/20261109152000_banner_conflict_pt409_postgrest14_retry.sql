-- Emergency production hardening: avoid unbounded PostgREST 14 retries.
-- The old version-check raised SQLSTATE 40001 (serialization_failure), which
-- PostgREST 14 retries indefinitely even though a stale version cannot change.
-- PT409 maps to HTTP 409 without retry, preserving optimistic concurrency.
-- See: https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
-- SQL function definition captured from original production before this change.
-- Preserve existing function signature, grants, service_role verification and
-- advisory transaction lock. Only the two business-conflict SQLSTATEs differ.

CREATE OR REPLACE FUNCTION public.taxpay_office_save_banner(p_banner jsonb, p_expected_version bigint DEFAULT NULL::bigint, p_position integer DEFAULT NULL::integer)
 RETURNS taxpay_site_banners
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_id text;
  v_previous public.taxpay_site_banners%rowtype;
  v_saved public.taxpay_site_banners%rowtype;
  v_ids text[];
  v_other text[];
  v_sorted text[] := array[]::text[];
  v_position integer;
  v_total integer;
  i integer;
begin
  if current_user <> 'service_role' then
    raise exception 'TAXPAY_OFFICE_SERVICE_ONLY' using errcode = '42501';
  end if;
  if p_banner is null or jsonb_typeof(p_banner) <> 'object' then
    raise exception 'Invalid banner payload.' using errcode = '22023';
  end if;
  v_id := p_banner->>'id';
  if v_id is null or v_id !~ '^[a-z][a-z0-9_-]{0,39}$' then
    raise exception 'Invalid banner ID.' using errcode = '22023';
  end if;
  if (p_banner->>'service_code') is not null
     and p_banner->>'service_code' not in ('TAX_WITH_RETURN','ADVANCE_TAX','SOURCE_TAX_DEPOSIT','TRAVEL_TAX') then
    raise exception 'Invalid banner service code.' using errcode = '22023';
  end if;
  if v_id='intro' and (
    nullif(p_banner->>'service_code','') is not null or
    (p_banner->>'published')::boolean is distinct from true
  ) then
    raise exception 'Canonical Main banner must remain published.' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(58007001);
  select * into v_previous from public.taxpay_site_banners where id=v_id for update;
  if found then
    if p_expected_version is distinct from v_previous.version then
      raise exception 'BANNER_VERSION_CONFLICT' using errcode='PT409';
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
      background_color = case when p_banner ? 'background_color' then p_banner->>'background_color' else v_previous.background_color end,
      heading_color = case when p_banner ? 'heading_color' then p_banner->>'heading_color' else v_previous.heading_color end,
      body_color = case when p_banner ? 'body_color' then p_banner->>'body_color' else v_previous.body_color end,
      outline_color = case when p_banner ? 'outline_color' then p_banner->>'outline_color' else v_previous.outline_color end,
      published = (p_banner->>'published')::boolean,
      updated_by = null
    where id = v_id
    returning * into v_saved;
  else
    if p_expected_version is not null then
      raise exception 'BANNER_VERSION_CONFLICT' using errcode='PT409';
    end if;
    insert into public.taxpay_site_banners
      (id,service_code,heading_en,heading_bn,description_en,description_bn,
       mobile_heading_en,mobile_heading_bn,mobile_description_en,mobile_description_bn,
       action_en,action_bn,desktop_image_path,mobile_image_path,
       background_color,heading_color,body_color,outline_color,published,sort_order,updated_by)
    values
      (v_id,nullif(p_banner->>'service_code',''),p_banner->>'heading_en',p_banner->>'heading_bn',
       p_banner->>'description_en',p_banner->>'description_bn',p_banner->>'mobile_heading_en',
       p_banner->>'mobile_heading_bn',p_banner->>'mobile_description_en',p_banner->>'mobile_description_bn',
       p_banner->>'action_en',p_banner->>'action_bn',p_banner->>'desktop_image_path',
       p_banner->>'mobile_image_path',p_banner->>'background_color',p_banner->>'heading_color',p_banner->>'body_color',p_banner->>'outline_color',
       (p_banner->>'published')::boolean,
       (select coalesce(max(sort_order),-1)+1 from public.taxpay_site_banners),null)
    returning * into v_saved;
  end if;
  if v_saved.id is null then
    raise exception 'Banner save was not committed.' using errcode='42501';
  end if;
  select array_agg(id order by sort_order,id) into v_ids from public.taxpay_site_banners;
  v_total := cardinality(v_ids);
  v_position := greatest(1,least(coalesce(p_position,v_total),v_total));
  v_other := array_remove(v_ids,v_id);
  for i in 1..v_total loop
    if i = v_position then v_sorted := array_append(v_sorted,v_id);
    elsif i < v_position then v_sorted := array_append(v_sorted,v_other[i]);
    else v_sorted := array_append(v_sorted,v_other[i-1]);
    end if;
  end loop;
  for i in 1..v_total loop
    update public.taxpay_site_banners set sort_order = i-1,updated_by = null
     where id=v_sorted[i] and sort_order is distinct from i-1;
  end loop;
  select * into v_saved from public.taxpay_site_banners where id=v_id;
  return v_saved;
end;
$function$
