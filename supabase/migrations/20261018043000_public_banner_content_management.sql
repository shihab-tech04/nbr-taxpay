-- Public banner copy is shared by TaxPay and the Office editor.
-- The single canonical SQL record prevents diverging cross-project copies.
create table if not exists public.taxpay_site_banners (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,39}$'),
  service_code text check (service_code is null or service_code in ('TAX_WITH_RETURN','ADVANCE_TAX','SOURCE_TAX_DEPOSIT','TRAVEL_TAX')),
  heading_en text not null, heading_bn text not null,
  description_en text not null, description_bn text not null,
  mobile_heading_en text not null check (char_length(mobile_heading_en) <= 24),
  mobile_heading_bn text not null check (char_length(mobile_heading_bn) <= 24),
  mobile_description_en text not null check (char_length(mobile_description_en) <= 34),
  mobile_description_bn text not null check (char_length(mobile_description_bn) <= 34),
  action_en text not null, action_bn text not null,
  desktop_image_path text,
  mobile_image_path text,
  sort_order int not null default 0,
  published boolean not null default false,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Also tighten an existing schema if this migration was introduced through SQL first.
alter table public.taxpay_site_banners
  drop constraint if exists taxpay_site_banners_mobile_heading_en_check,
  add constraint taxpay_site_banners_mobile_heading_en_check check (char_length(mobile_heading_en) <= 24),
  drop constraint if exists taxpay_site_banners_mobile_heading_bn_check,
  add constraint taxpay_site_banners_mobile_heading_bn_check check (char_length(mobile_heading_bn) <= 24),
  drop constraint if exists taxpay_site_banners_mobile_description_en_check,
  add constraint taxpay_site_banners_mobile_description_en_check check (char_length(mobile_description_en) <= 34),
  drop constraint if exists taxpay_site_banners_mobile_description_bn_check,
  add constraint taxpay_site_banners_mobile_description_bn_check check (char_length(mobile_description_bn) <= 34);

alter table public.taxpay_site_banners enable row level security;
grant select on public.taxpay_site_banners to anon, authenticated;
grant insert, update, delete on public.taxpay_site_banners to authenticated;

create or replace function public.taxpay_is_verified_portal_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.taxpay_portal_admins a
   where a.user_uid = (select auth.uid()) and a.active);
$$;
revoke all on function public.taxpay_is_verified_portal_admin() from public;
grant execute on function public.taxpay_is_verified_portal_admin() to authenticated;

drop policy if exists "public reads published banners" on public.taxpay_site_banners;
create policy "public reads published banners"
on public.taxpay_site_banners for select to anon, authenticated
using (published);
drop policy if exists "verified administrator reads all banners" on public.taxpay_site_banners;
create policy "verified administrator reads all banners"
on public.taxpay_site_banners for select to authenticated
using ((select public.taxpay_is_verified_portal_admin()));
drop policy if exists "verified administrator inserts banners" on public.taxpay_site_banners;
create policy "verified administrator inserts banners"
on public.taxpay_site_banners for insert to authenticated
with check ((select public.taxpay_is_verified_portal_admin()) and updated_by = (select auth.uid()));
drop policy if exists "verified administrator updates banners" on public.taxpay_site_banners;
create policy "verified administrator updates banners"
on public.taxpay_site_banners for update to authenticated
using ((select public.taxpay_is_verified_portal_admin()))
with check ((select public.taxpay_is_verified_portal_admin()) and updated_by = (select auth.uid()));
drop policy if exists "verified administrator deletes banners" on public.taxpay_site_banners;
create policy "verified administrator deletes banners"
on public.taxpay_site_banners for delete to authenticated
using ((select public.taxpay_is_verified_portal_admin()));

create or replace function public.taxpay_banner_audit_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists taxpay_banner_update on public.taxpay_site_banners;
create trigger taxpay_banner_update before update on public.taxpay_site_banners
for each row execute function public.taxpay_banner_audit_update();

create table if not exists public.taxpay_site_banner_history (
  audit_id bigint generated always as identity primary key,
  banner_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  prior_record jsonb,
  next_record jsonb,
  actor_uid uuid,
  changed_at timestamptz not null default now()
);
alter table public.taxpay_site_banner_history enable row level security;
revoke all on public.taxpay_site_banner_history from public, anon, authenticated;
grant select on public.taxpay_site_banner_history to authenticated;
drop policy if exists "verified administrator reads banner history" on public.taxpay_site_banner_history;
create policy "verified administrator reads banner history"
on public.taxpay_site_banner_history for select to authenticated
using ((select public.taxpay_is_verified_portal_admin()));

create or replace function public.taxpay_log_banner_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.taxpay_site_banner_history
    (banner_id, operation, prior_record, next_record, actor_uid)
  values (coalesce(new.id, old.id), tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end;
$$;
revoke all on function public.taxpay_log_banner_change() from public, anon, authenticated;
drop trigger if exists taxpay_banner_history on public.taxpay_site_banners;
create trigger taxpay_banner_history after insert or update or delete
on public.taxpay_site_banners for each row execute function public.taxpay_log_banner_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('taxpay-banners', 'taxpay-banners', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "verified administrator uploads banner assets" on storage.objects;
create policy "verified administrator uploads banner assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'taxpay-banners' and (select public.taxpay_is_verified_portal_admin()));
drop policy if exists "verified administrator manages banner assets" on storage.objects;
create policy "verified administrator manages banner assets"
on storage.objects for update to authenticated
using (bucket_id = 'taxpay-banners' and (select public.taxpay_is_verified_portal_admin()))
with check (bucket_id = 'taxpay-banners' and (select public.taxpay_is_verified_portal_admin()));
drop policy if exists "verified administrator deletes banner assets" on storage.objects;
create policy "verified administrator deletes banner assets"
on storage.objects for delete to authenticated
using (bucket_id = 'taxpay-banners' and (select public.taxpay_is_verified_portal_admin()));

insert into public.taxpay_site_banners
  (id,service_code,heading_en,heading_bn,description_en,description_bn,mobile_heading_en,mobile_heading_bn,mobile_description_en,mobile_description_bn,action_en,action_bn,sort_order,published)
values
('intro',null,'Tax payments, without the confusion.','কর পরিশোধে আর বিভ্রান্তি নয়।','Unsure what tax to pay or where your receipt went? Choose the right service, follow clear steps, and find payment records in one place.','কোন কর দেবেন বা রসিদ কোথায় পাবেন বুঝতে পারছেন না? সঠিক সেবা বেছে নিন, সহজ ধাপে কর দিন ও পেমেন্টের রেকর্ড খুঁজে নিন।','Pay tax with confidence','কর পরিশোধ সহজ করুন','Pay, track and find receipts.','কর দিন, রসিদ ও অবস্থা দেখুন।','Pay Tax','কর পরিশোধ',0,true),
('return','TAX_WITH_RETURN','Tax with Return','রিটার্নের সঙ্গে কর','Settle the income tax linked to your return through clear, guided steps.','রিটার্নের সঙ্গে সংশ্লিষ্ট আয়কর সহজ ও স্পষ্ট ধাপে পরিশোধ করুন।','Tax with Return','রিটার্নের সঙ্গে কর','Pay tax linked to your return.','রিটার্নের কর পরিশোধ করুন।','Pay Tax with Return','রিটার্নের সঙ্গে কর পরিশোধ',1,true),
('advance','ADVANCE_TAX','Advance Income Tax','অগ্রিম আয়কর','Plan ahead by paying income tax early for your chosen assessment year.','নির্বাচিত করবর্ষে আগাম আয়কর দিয়ে আপনার কর পরিকল্পনা এগিয়ে নিন।','Advance Income Tax','অগ্রিম আয়কর','Pay early for your tax year.','করবর্ষ অনুযায়ী অগ্রিম কর দিন।','Pay Advance Income Tax','অগ্রিম আয়কর পরিশোধ',2,true),
('withholding','SOURCE_TAX_DEPOSIT','Source Tax Deposit (TDS/TCS)','উৎসে কর জমা (টিডিএস/টিসিএস)','Deposit tax already deducted or collected at source using the right payment head.','উৎসে কাটা বা সংগৃহীত কর সঠিক খাতে সহজে জমা দিন।','Source Tax (TDS/TCS)','উৎসে কর জমা','Deposit deducted or collected tax.','কাটা বা সংগৃহীত কর জমা দিন।','Deposit Source Tax','উৎসে কর জমা দিন',3,true),
('travel','TRAVEL_TAX','Travel Tax','ভ্রমণ কর','Choose your journey, add passenger details and move through travel tax with confidence.','ভ্রমণের ধরন ও যাত্রীর তথ্য দিয়ে ভ্রমণ করের ধাপগুলো সহজে এগিয়ে নিন।','Travel Tax','ভ্রমণ কর','Pay tax for your journey.','ভ্রমণের জন্য কর দিন।','Pay Travel Tax','ভ্রমণ কর পরিশোধ',4,true)
on conflict (id) do nothing;
