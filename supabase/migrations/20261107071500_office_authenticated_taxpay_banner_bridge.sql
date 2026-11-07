-- Only the server-side TaxPay Edge Function (service_role) may invoke this
-- Office-authenticated banner publishing operation. The server checks the
-- OFFICE Supabase Auth identity first. This does not grant anonymous access.
create or replace function public.taxpay_office_save_banner(
  p_banner jsonb,
  p_expected_version bigint default null,
  p_position integer default null
)
returns public.taxpay_site_banners
language plpgsql
security invoker
set search_path = ''
as $function$
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
      raise exception 'BANNER_VERSION_CONFLICT' using errcode='40001';
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
      updated_by = null
    where id = v_id
    returning * into v_saved;
  else
    if p_expected_version is not null then
      raise exception 'BANNER_VERSION_CONFLICT' using errcode='40001';
    end if;
    insert into public.taxpay_site_banners
      (id,service_code,heading_en,heading_bn,description_en,description_bn,
       mobile_heading_en,mobile_heading_bn,mobile_description_en,mobile_description_bn,
       action_en,action_bn,desktop_image_path,mobile_image_path,published,sort_order,updated_by)
    values
      (v_id,nullif(p_banner->>'service_code',''),p_banner->>'heading_en',p_banner->>'heading_bn',
       p_banner->>'description_en',p_banner->>'description_bn',p_banner->>'mobile_heading_en',
       p_banner->>'mobile_heading_bn',p_banner->>'mobile_description_en',p_banner->>'mobile_description_bn',
       p_banner->>'action_en',p_banner->>'action_bn',p_banner->>'desktop_image_path',
       p_banner->>'mobile_image_path',(p_banner->>'published')::boolean,
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
$function$;

-- PostgREST's database role restriction is defense in depth; ordinary
-- authenticated TaxPay customers cannot invoke this service-only RPC.
revoke all on function public.taxpay_office_save_banner(jsonb,bigint,integer) from public,anon,authenticated;
grant execute on function public.taxpay_office_save_banner(jsonb,bigint,integer) to service_role;