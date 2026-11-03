-- Preserve fixed tag semantics and saved-list identity. Add a user-written label
-- ONLY for Others; never imply a verified relationship or taxpayer permission.
begin;

alter table public.taxpay_beneficiaries
  add column other_label text,
  add constraint taxpay_beneficiary_other_label_consistency check (
    (tag = 'others' and other_label is not null and
      length(other_label) between 1 and 80 and other_label = btrim(other_label))
    or (tag is distinct from 'others' and other_label is null)
  );

alter table taxpay_guest_private.beneficiaries
  add column other_label text,
  add constraint taxpay_guest_beneficiary_other_label_consistency check (
    (tag = 'others' and other_label is not null and
      length(other_label) between 1 and 80 and other_label = btrim(other_label))
    or (tag is distinct from 'others' and other_label is null)
  );

comment on column public.taxpay_beneficiaries.other_label
  is 'Payer-entered description (1–80 characters) for Others tag only; unverified self-declaration.';
comment on column taxpay_guest_private.beneficiaries.other_label
  is 'Capability-owner description (1–80 characters) for Others tag only; unverified.';

-- Preserve the existing capability session, paging and read isolation.
create or replace function public.taxpay_guest_beneficiary_rows(
  p_capability_hash text, p_offset integer default 0, p_limit integer default 500
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private
as $fn$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'INVALID_PAGE';
  end if;
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'list_id', list_id, 'tin', tin, 'display_name', display_name,
    'tag', tag, 'relationship', relationship, 'other_label', other_label,
    'created_at', created_at, 'updated_at', updated_at
  ) order by created_at desc, id desc), '[]'::jsonb)
  into v_result
  from (
    select id,list_id,tin,display_name,tag,relationship,other_label,created_at,updated_at
    from taxpay_guest_private.beneficiaries
    where session_id = v_session_id
    order by created_at desc,id desc
    offset p_offset limit p_limit
  ) page;
  return v_result;
end;
$fn$;

-- Existing guest RPC signature and grants stay intact. The only new parameters
-- are JSON properties inside p_rows, validated and stored atomically.
create or replace function public.taxpay_guest_beneficiary_add(
  p_capability_hash text, p_list_id uuid, p_rows jsonb
)
returns integer language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private
as $fn$
declare
  v_session_id uuid;
  v_row jsonb;
  v_tin text;
  v_name text;
  v_tag text;
  v_relationship text;
  v_other_label text;
  v_inserted integer := 0;
  v_count integer;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_ROWS'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count > 1000 then raise exception 'INVALID_ROWS'; end if;
  if not exists(select 1 from taxpay_guest_private.lists where id = p_list_id and session_id = v_session_id) then
    raise exception 'NOT_FOUND';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_tin := v_row->>'tin';
    v_name := btrim(coalesce(v_row->>'display_name', ''));
    v_tag := v_row->>'tag';
    v_relationship := v_row->>'relationship';
    v_other_label := v_row->>'other_label';
    if v_tin is null or v_tin !~ '^[0-9]{12}$' or length(v_name) not between 1 and 160 or
      not (
        (v_tag is null and v_relationship is null and v_other_label is null) or
        (v_tag = 'clients' and v_relationship is null and v_other_label is null) or
        (v_tag = 'others' and v_relationship is null and v_other_label is not null
          and length(v_other_label) between 1 and 80 and v_other_label = btrim(v_other_label)) or
        (v_tag = 'friends_family' and v_other_label is null and v_relationship in
          ('father','mother','siblings','son','daughter','spouse','friends'))
      ) then
      raise exception 'INVALID_BENEFICIARY';
    end if;
    insert into taxpay_guest_private.beneficiaries(session_id,list_id,tin,display_name,tag,relationship,other_label)
    values (v_session_id,p_list_id,v_tin,v_name,v_tag,v_relationship,v_other_label)
    on conflict (list_id,tin) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$fn$;


commit;
