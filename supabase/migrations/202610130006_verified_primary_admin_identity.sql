-- Controlled primary administrator identity for the independent TaxPay/Office preview.
-- The login alias 'admin' is NOT a password or authorization grant.
-- Only a Supabase-verified email owner can hold this role.
-- No maker/reviewer/approver financial role is granted here.
create table if not exists public.taxpay_portal_admins (
  user_uid uuid primary key references auth.users(id) on delete cascade,
  login_id text not null default 'admin' check (login_id = 'admin'),
  email text not null unique check (email = 'shihabshajib01@gmail.com'),
  active boolean not null default true,
  verified_at timestamptz not null,
  granted_at timestamptz not null default now()
);

alter table public.taxpay_portal_admins enable row level security;
revoke all on public.taxpay_portal_admins from public, anon, authenticated;
grant select on public.taxpay_portal_admins to authenticated;

drop policy if exists "verified portal admin may inspect own role" on public.taxpay_portal_admins;
create policy "verified portal admin may inspect own role"
on public.taxpay_portal_admins for select to authenticated
using (user_uid = (select auth.uid()) and active);

-- This trusted database trigger is not callable as a browser RPC.
-- Role is activated only after Supabase verifies the exact approved mailbox.
create or replace function public.taxpay_sync_verified_primary_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.lower(coalesce(new.email,'')) = 'shihabshajib01@gmail.com'
    and new.email_confirmed_at is not null
    and coalesce(new.email_change,'') = ''
    and new.deleted_at is null
    and (new.banned_until is null or new.banned_until <= pg_catalog.now())
  then
    insert into public.taxpay_portal_admins (user_uid, login_id, email, active, verified_at)
    values (new.id, 'admin', 'shihabshajib01@gmail.com', true, new.email_confirmed_at)
    on conflict (user_uid) do update set
      email = excluded.email,
      active = true,
      verified_at = excluded.verified_at;
  else
    delete from public.taxpay_portal_admins where user_uid = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.taxpay_sync_verified_primary_admin() from public, anon, authenticated;

drop trigger if exists taxpay_verified_primary_admin_sync on auth.users;
create trigger taxpay_verified_primary_admin_sync
after insert or update of email, email_confirmed_at, email_change, banned_until, deleted_at
on auth.users for each row
execute function public.taxpay_sync_verified_primary_admin();

-- Backfill only an already verified owner; no guest, unverified or unrelated
-- account becomes an administrator because a username matches 'admin'.
insert into public.taxpay_portal_admins (user_uid, login_id, email, active, verified_at)
select u.id, 'admin', 'shihabshajib01@gmail.com', true, u.email_confirmed_at
from auth.users u
where pg_catalog.lower(u.email) = 'shihabshajib01@gmail.com'
  and u.email_confirmed_at is not null
  and coalesce(u.email_change,'') = ''
  and u.deleted_at is null
  and (u.banned_until is null or u.banned_until <= pg_catalog.now())
on conflict (user_uid) do update set
  active = true, verified_at = excluded.verified_at;
