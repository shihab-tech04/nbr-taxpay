begin;

-- Fictional user1-user10 previews have a shared backend record per demo ID.
-- This NEVER creates an Auth user, payment permission, or taxpayer ownership.
-- The previous browser-capability books and authenticated account data are unchanged.
create table if not exists taxpay_guest_private.demo_profiles (
  demo_id text primary key check (demo_id ~ '^user(10|[1-9])$'),
  capability_token text not null unique
    default translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_'),
  payment_session_id uuid not null unique default gen_random_uuid(),
  language text not null default 'en' check (language in ('en', 'bn')),
  selected_list_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_profile_token_length check (capability_token ~ '^[A-Za-z0-9_-]{43}$')
);
alter table taxpay_guest_private.demo_profiles enable row level security;
alter table taxpay_guest_private.demo_profiles force row level security;
revoke all on taxpay_guest_private.demo_profiles from public, anon, authenticated, service_role;
insert into taxpay_guest_private.demo_profiles(demo_id)
select 'user' || n from generate_series(1,10) n
on conflict (demo_id) do nothing;

-- Called exclusively by the already existing guest Edge Function's service role.
-- Passwords userN/userN are intentionally PUBLIC DEMO credentials; never treat
-- this as proof of taxpayer identity or use it for private account/financial RLS.
create or replace function public.taxpay_demo_profile_login(
  p_demo_id text, p_password text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private, extensions
as $$
declare
  v_profile taxpay_guest_private.demo_profiles%rowtype;
  v_cap_hash text;
begin
  if p_demo_id is null or p_demo_id !~ '^user(10|[1-9])$'
     or p_password is distinct from p_demo_id then
    raise exception 'INVALID_DEMO_LOGIN';
  end if;
  select * into v_profile from taxpay_guest_private.demo_profiles
    where demo_id = p_demo_id;
  if not found then raise exception 'INVALID_DEMO_LOGIN'; end if;
  v_cap_hash := encode(extensions.digest(convert_to(v_profile.capability_token,'UTF8'),'sha256'),'hex');
  perform public.taxpay_guest_beneficiary_open(v_cap_hash);
  return jsonb_build_object(
    'profileId',v_profile.demo_id,
    'capability',v_profile.capability_token,
    'paymentSessionId',v_profile.payment_session_id,
    'language',v_profile.language,
    'selectedListId',v_profile.selected_list_id
  );
end;
$$;

create or replace function public.taxpay_demo_profile_settings(
  p_capability_hash text, p_key text default null, p_value text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private, extensions
as $$
declare
  v_profile taxpay_guest_private.demo_profiles%rowtype;
  v_session_id uuid;
  v_list_id uuid;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CAPABILITY';
  end if;
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  select * into v_profile from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash
   for update;
  if not found then raise exception 'INVALID_DEMO_PROFILE'; end if;
  if p_key is not null then
    if p_key='language' and p_value in ('en','bn') then
      update taxpay_guest_private.demo_profiles
        set language=p_value, updated_at=now() where demo_id=v_profile.demo_id;
    elsif p_key='selected-list' then
      if p_value is null or p_value='' then
        v_list_id := null;
      else
        begin v_list_id := p_value::uuid;
        exception when invalid_text_representation then raise exception 'INVALID_LIST'; end;
        if not exists (
          select 1 from taxpay_guest_private.lists
           where id=v_list_id and session_id=v_session_id
        ) then raise exception 'INVALID_LIST'; end if;
      end if;
      update taxpay_guest_private.demo_profiles
        set selected_list_id=v_list_id, updated_at=now() where demo_id=v_profile.demo_id;
    else raise exception 'INVALID_PREFERENCE'; end if;
  end if;
  select * into v_profile from taxpay_guest_private.demo_profiles where demo_id=v_profile.demo_id;
  return jsonb_build_object(
    'language',v_profile.language,
    'selectedListId',v_profile.selected_list_id,
    'paymentSessionId',v_profile.payment_session_id
  );
end;
$$;

revoke all on function public.taxpay_demo_profile_login(text,text) from public, anon, authenticated;
revoke all on function public.taxpay_demo_profile_settings(text,text,text) from public, anon, authenticated;
grant execute on function public.taxpay_demo_profile_login(text,text) to service_role;
grant execute on function public.taxpay_demo_profile_settings(text,text,text) to service_role;
commit;
