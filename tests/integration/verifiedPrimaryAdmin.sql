-- Local disposable acceptance only; everything is rolled back.
\set ON_ERROR_STOP on
begin;

do $$
declare admin_uid uuid:=gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values(admin_uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','shihabshajib01@gmail.com',now(),now());
  if exists(select 1 from public.taxpay_portal_admins where user_uid=admin_uid)
    then raise exception 'FAIL: unverified admin was granted access'; end if;

  update auth.users set email_confirmed_at=now() where id=admin_uid;
  if not exists(select 1 from public.taxpay_portal_admins
                where user_uid=admin_uid and active=true and login_id='admin')
    then raise exception 'FAIL: verified approved email not provisioned'; end if;
  if exists(select 1 from public.taxpay_officer_roles where user_uid=admin_uid)
    then raise exception 'FAIL: admin was improperly given an officer approval role'; end if;

  update auth.users set email='unapproved-account@example.test' where id=admin_uid;
  if exists(select 1 from public.taxpay_portal_admins where user_uid=admin_uid)
    then raise exception 'FAIL: changing verified admin email retained privileges'; end if;

  -- Restore address, but without fresh email verification.
  update auth.users set email='shihabshajib01@gmail.com', email_confirmed_at=null where id=admin_uid;
  if exists(select 1 from public.taxpay_portal_admins where user_uid=admin_uid)
    then raise exception 'FAIL: unverified email regained admin access'; end if;
end;
$$;

do $$
begin
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='taxpay_portal_admins'
        and cmd='SELECT' and 'authenticated'=any(roles))<>1
    then raise exception 'FAIL: admin membership RLS policy missing'; end if;
  if has_table_privilege('anon','public.taxpay_portal_admins','SELECT')
    then raise exception 'FAIL: anonymous admin role disclosure'; end if;
  if has_table_privilege('authenticated','public.taxpay_portal_admins','INSERT')
    or has_table_privilege('authenticated','public.taxpay_portal_admins','UPDATE')
    or has_table_privilege('authenticated','public.taxpay_portal_admins','DELETE')
    then raise exception 'FAIL: authenticated account can self-grant admin role'; end if;
end;
$$;

rollback;
\echo 'PASS: only confirmed admin email gets a separate role; no officer privilege; role revokes after email change; RLS is fail-closed';
