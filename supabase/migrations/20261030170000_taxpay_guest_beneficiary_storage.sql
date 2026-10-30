begin;

-- Guest address books use a separate private schema. The existing account-owned
-- tables and their authenticated owner_uid RLS policies remain untouched.
create schema taxpay_guest_private;
revoke all on schema taxpay_guest_private from public, anon, authenticated, service_role;

create table taxpay_guest_private.sessions (
  id uuid primary key default gen_random_uuid(),
  capability_hash text not null unique check (capability_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '730 days'
);
create index taxpay_guest_private_session_expiry_idx
  on taxpay_guest_private.sessions(expires_at);

create table taxpay_guest_private.lists (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references taxpay_guest_private.sessions(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, session_id)
);
create unique index taxpay_guest_private_list_name_idx
  on taxpay_guest_private.lists(session_id, lower(name));

create table taxpay_guest_private.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  list_id uuid not null,
  tin text not null check (tin ~ '^[0-9]{12}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, tin),
  foreign key (list_id, session_id)
    references taxpay_guest_private.lists(id, session_id) on delete cascade
);
create index taxpay_guest_private_beneficiary_session_order_idx
  on taxpay_guest_private.beneficiaries(session_id, created_at desc, id desc);

alter table taxpay_guest_private.sessions enable row level security;
alter table taxpay_guest_private.sessions force row level security;
alter table taxpay_guest_private.lists enable row level security;
alter table taxpay_guest_private.lists force row level security;
alter table taxpay_guest_private.beneficiaries enable row level security;
alter table taxpay_guest_private.beneficiaries force row level security;
revoke all on all tables in schema taxpay_guest_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema taxpay_guest_private from public, anon, authenticated, service_role;

create function taxpay_guest_private.touch_session(p_capability_hash text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CAPABILITY';
  end if;
  delete from taxpay_guest_private.sessions where expires_at <= now();
  update taxpay_guest_private.sessions
     set last_seen_at = now(), expires_at = now() + interval '730 days'
   where capability_hash = p_capability_hash
     and expires_at > now()
   returning id into v_session_id;
  if v_session_id is null then
    raise exception 'GUEST_SESSION_UNAVAILABLE';
  end if;
  return v_session_id;
end;
$$;

create function public.taxpay_guest_beneficiary_open(p_capability_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CAPABILITY';
  end if;
  delete from taxpay_guest_private.sessions where expires_at <= now();
  insert into taxpay_guest_private.sessions as guest_session(capability_hash)
  values (p_capability_hash)
  on conflict (capability_hash) do update
    set last_seen_at = now(), expires_at = now() + interval '730 days'
    where guest_session.expires_at > now()
  returning id into v_session_id;
  if v_session_id is null then
    raise exception 'GUEST_SESSION_UNAVAILABLE';
  end if;
  return jsonb_build_object('active', true);
end;
$$;

create function public.taxpay_guest_beneficiary_lists(p_capability_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'created_at', created_at
  ) order by lower(name), id), '[]'::jsonb)
    into v_result
    from taxpay_guest_private.lists
   where session_id = v_session_id;
  return v_result;
end;
$$;

create function public.taxpay_guest_beneficiary_rows(
  p_capability_hash text, p_offset integer default 0, p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
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
    'created_at', created_at, 'updated_at', updated_at
  ) order by created_at desc, id desc), '[]'::jsonb)
    into v_result
    from (
      select id, list_id, tin, display_name, created_at, updated_at
        from taxpay_guest_private.beneficiaries
       where session_id = v_session_id
       order by created_at desc, id desc
       offset p_offset limit p_limit
    ) page;
  return v_result;
end;
$$;

create function public.taxpay_guest_beneficiary_create_list(
  p_capability_hash text, p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
  v_list taxpay_guest_private.lists%rowtype;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception 'INVALID_LIST_NAME';
  end if;
  select * into v_list from taxpay_guest_private.lists
   where session_id = v_session_id and lower(name) = lower(btrim(p_name));
  if not found then
    begin
      insert into taxpay_guest_private.lists(session_id, name)
      values (v_session_id, btrim(p_name)) returning * into v_list;
    exception when unique_violation then
      select * into v_list from taxpay_guest_private.lists
       where session_id = v_session_id and lower(name) = lower(btrim(p_name));
    end;
  end if;
  return jsonb_build_object('id', v_list.id, 'name', v_list.name, 'created_at', v_list.created_at);
end;
$$;

create function public.taxpay_guest_beneficiary_add(
  p_capability_hash text, p_list_id uuid, p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
  v_row jsonb;
  v_tin text;
  v_name text;
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
    if v_tin is null or v_tin !~ '^[0-9]{12}$' or length(v_name) not between 1 and 160 then
      raise exception 'INVALID_BENEFICIARY';
    end if;
    insert into taxpay_guest_private.beneficiaries(session_id, list_id, tin, display_name)
    values (v_session_id, p_list_id, v_tin, v_name)
    on conflict (list_id, tin) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$$;

create function public.taxpay_guest_beneficiary_update(
  p_capability_hash text, p_beneficiary_id uuid, p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_name is null or length(btrim(p_name)) not between 1 and 160 then
    raise exception 'INVALID_BENEFICIARY_NAME';
  end if;
  update taxpay_guest_private.beneficiaries
     set display_name = btrim(p_name), updated_at = now()
   where id = p_beneficiary_id and session_id = v_session_id
   returning jsonb_build_object('id', id, 'list_id', list_id, 'tin', tin,
     'display_name', display_name, 'created_at', created_at, 'updated_at', updated_at)
        into v_result;
  if v_result is null then raise exception 'NOT_FOUND'; end if;
  return v_result;
end;
$$;

create function public.taxpay_guest_beneficiary_remove(
  p_capability_hash text, p_beneficiary_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  delete from taxpay_guest_private.beneficiaries
   where id = p_beneficiary_id and session_id = v_session_id;
  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function taxpay_guest_private.touch_session(text) from public, anon, authenticated, service_role;
revoke all on function public.taxpay_guest_beneficiary_open(text) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_lists(text) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_rows(text, integer, integer) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_create_list(text, text) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_add(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_update(text, uuid, text) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_remove(text, uuid) from public, anon, authenticated;
grant execute on function public.taxpay_guest_beneficiary_open(text) to service_role;
grant execute on function public.taxpay_guest_beneficiary_lists(text) to service_role;
grant execute on function public.taxpay_guest_beneficiary_rows(text, integer, integer) to service_role;
grant execute on function public.taxpay_guest_beneficiary_create_list(text, text) to service_role;
grant execute on function public.taxpay_guest_beneficiary_add(text, uuid, jsonb) to service_role;
grant execute on function public.taxpay_guest_beneficiary_update(text, uuid, text) to service_role;
grant execute on function public.taxpay_guest_beneficiary_remove(text, uuid) to service_role;

comment on schema taxpay_guest_private is
  'Guest-only beneficiary address book. Accessible through capability-validated, service-role-only RPCs.';
comment on table taxpay_guest_private.sessions is
  'Stores only SHA-256 digests of unguessable browser guest capabilities; raw capabilities stay in browser storage.';
comment on table taxpay_guest_private.beneficiaries is
  'Guest address-book data, separate from account-owned beneficiary tables and excluded from payment/account records.';

commit;
