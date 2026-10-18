-- One canonical logo record shared by the Office Content Management editor and
-- every public/taxpayer TaxPay shell. A null image path retains the approved
-- bundled Amar Kor wordmark until the first administrator upload.
create table if not exists public.taxpay_site_logo (
  id text primary key default 'primary' check (id = 'primary'),
  image_path text,
  image_width integer,
  image_height integer,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint taxpay_site_logo_dimensions_check check (
    (image_path is null and image_width is null and image_height is null)
    or (
      image_path ~ '^logos/[a-f0-9-]{36}\.(png|jpg|webp)$'
      and image_width between 600 and 6000
      and image_height between 120 and 2000
      and image_width::numeric / nullif(image_height, 0) between 3.5 and 6.5
    )
  )
);

insert into public.taxpay_site_logo (id) values ('primary')
on conflict (id) do nothing;

alter table public.taxpay_site_logo enable row level security;
grant select, update on public.taxpay_site_logo to anon, authenticated;

drop policy if exists "TaxPay visitors read the shared site logo" on public.taxpay_site_logo;
create policy "TaxPay visitors read the shared site logo"
on public.taxpay_site_logo for select to anon, authenticated using (true);

-- Consistent with the user-approved temporary 'admin' ID-only Banner CMS:
-- there is no server-verifiable credential. Restrict this grant to the
-- branding singleton; it must never apply to payments or taxpayer data.
drop policy if exists "Office ID-only editor updates the site logo" on public.taxpay_site_logo;
create policy "Office ID-only editor updates the site logo"
on public.taxpay_site_logo for update to anon, authenticated
using (id = 'primary') with check (id = 'primary');

create or replace function public.taxpay_site_logo_version_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists taxpay_site_logo_version on public.taxpay_site_logo;
create trigger taxpay_site_logo_version before update on public.taxpay_site_logo
for each row execute function public.taxpay_site_logo_version_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taxpay-branding', 'taxpay-branding', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "Office ID-only editor uploads site logos" on storage.objects;
create policy "Office ID-only editor uploads site logos"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'taxpay-branding'
  and name ~ '^logos/[a-f0-9-]{36}\.(png|jpg|webp)$'
);

-- Postgres Changes plus a foreground/periodic refresh in the public client:
-- existing tabs update promptly, while visitors who missed an event catch up.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'taxpay_site_logo'
  ) then
    alter publication supabase_realtime add table public.taxpay_site_logo;
  end if;
end $$;
