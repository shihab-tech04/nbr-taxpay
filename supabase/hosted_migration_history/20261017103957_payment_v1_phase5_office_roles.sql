-- Office authentication/authorization API, without automatic user creation.
-- Grant/revoke is strictly service-role-only and requires an explicit reason.

create table if not exists payment_sync.officer_role_change_log (
  change_id uuid primary key default gen_random_uuid(),
  user_uid uuid not null references auth.users(id),
  old_role text,
  old_active boolean,
  new_role text not null check (new_role in ('MAKER','REVIEWER','APPROVER')),
  new_active boolean not null,
  reason text not null check (length(reason) between 8 and 500),
  changed_at timestamptz not null default now()
);
create index if not exists payment_v1_role_changes_by_uid
  on payment_sync.officer_role_change_log(user_uid,changed_at desc);
alter table payment_sync.officer_role_change_log enable row level security;
revoke all on payment_sync.officer_role_change_log from public,anon,authenticated;

create or replace function public.payment_v1_office_my_role()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_actor uuid := auth.uid(); v_origin text; v_role text; v_active boolean;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin<>'OFFICE_SQL' then raise exception 'Office-only role discovery'; end if;
  select r.role,r.active into v_role,v_active
    from payment_sync.officer_roles r where r.user_uid=v_actor;
  return pg_catalog.jsonb_build_object('role',v_role,
    'active',coalesce(v_active,false));
end;
$function$;

create or replace function public.payment_v1_internal_set_officer_role(
  p_user_uid uuid,p_role text,p_active boolean,p_reason text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_origin text; v_old_role text; v_old_active boolean;
  v_reason text := pg_catalog.btrim(p_reason);
begin
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin<>'OFFICE_SQL' then raise exception 'Office-only role administration'; end if;
  if p_user_uid is null or p_role is null or
     p_role not in ('MAKER','REVIEWER','APPROVER') or p_active is null or
     length(coalesce(v_reason,'')) not between 8 and 500 then
    raise exception 'Valid user, role, active state and reason required'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_uid) then
    raise exception 'Officer account must exist before role assignment'; end if;
  select r.role,r.active into v_old_role,v_old_active
    from payment_sync.officer_roles r where r.user_uid=p_user_uid for update;
  if v_old_role is not distinct from p_role and v_old_active is not distinct from p_active then
    return pg_catalog.jsonb_build_object('userUid',p_user_uid,
      'role',p_role,'active',p_active,'unchanged',true);
  end if;
  insert into payment_sync.officer_roles(user_uid,role,active)
    values(p_user_uid,p_role,p_active)
    on conflict(user_uid) do update set role=excluded.role,active=excluded.active;
  insert into payment_sync.officer_role_change_log(user_uid,old_role,old_active,
    new_role,new_active,reason)
    values(p_user_uid,v_old_role,v_old_active,p_role,p_active,v_reason);
  return pg_catalog.jsonb_build_object('userUid',p_user_uid,
    'role',p_role,'active',p_active,'unchanged',false);
end;
$function$;

revoke all on function public.payment_v1_office_my_role() from public,anon,authenticated;
grant execute on function public.payment_v1_office_my_role() to authenticated;
revoke all on function public.payment_v1_internal_set_officer_role(uuid,text,boolean,text)
  from public,anon,authenticated;
grant execute on function public.payment_v1_internal_set_officer_role(uuid,text,boolean,text)
  to service_role;
