-- Application-owned problem reports are support records, not evidence of payment.
-- Keep anonymous table access closed. Only a server-side service-role function
-- accepts submissions; authenticated verified Office admins can read/review.
create table if not exists public.taxpay_public_issue_reports (
  id uuid primary key default gen_random_uuid(),
  reference text generated always as ('KRB-' || upper(substr(replace(id::text,'-',''),1,12))) stored unique,
  submission_key uuid not null unique,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  category text not null check (category in ('payment','reference','security')),
  details text not null check (char_length(btrim(details)) between 10 and 500),
  status text not null default 'received' check (status in ('received','in_review','resolved','closed')),
  review_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid
);
alter table public.taxpay_public_issue_reports enable row level security;
revoke all on public.taxpay_public_issue_reports from public,anon,authenticated;
grant select on public.taxpay_public_issue_reports to authenticated;
grant update(status,review_note,updated_at,reviewed_by) on public.taxpay_public_issue_reports to authenticated;
grant select,insert,update on public.taxpay_public_issue_reports to service_role;
create policy taxpay_public_issue_verified_admin_read
  on public.taxpay_public_issue_reports for select to authenticated
  using ((select public.taxpay_is_verified_portal_admin()));
create policy taxpay_public_issue_verified_admin_update
  on public.taxpay_public_issue_reports for update to authenticated
  using ((select public.taxpay_is_verified_portal_admin()))
  with check ((select public.taxpay_is_verified_portal_admin()));
-- Narrow service-role function: server-derived source hash, atomic quota,
-- safe idempotent retries, and no public read of a ticket's private details.
create or replace function public.taxpay_record_public_issue(
  p_category text,p_details text,p_submission_key uuid,p_source_hash text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_report public.taxpay_public_issue_reports%rowtype;
 v_details text := btrim(p_details);
begin
 if current_user <> 'service_role' then
   raise exception 'Server mediation required.' using errcode='42501';
 end if;
 if p_submission_key is null or p_category not in ('payment','reference','security')
    or v_details is null or char_length(v_details) not between 10 and 500
    or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid support submission.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_source_hash,0));
 select * into v_report from public.taxpay_public_issue_reports
   where submission_key=p_submission_key;
 if found then
   if v_report.source_hash is distinct from p_source_hash then
     raise exception 'Submission key collision.' using errcode='22023';
   end if;
   return jsonb_build_object('reference',v_report.reference,
     'tracking_token',v_report.tracking_secret::text,'status',v_report.status);
 end if;
 if (select count(*) from public.taxpay_public_issue_reports
     where source_hash=p_source_hash and submitted_at>now()-interval '1 hour')>=4 then
   raise exception 'Submission limit reached.' using errcode='P0001';
 end if;
 insert into public.taxpay_public_issue_reports(category,details,submission_key,source_hash)
   values(p_category,v_details,p_submission_key,p_source_hash)
   returning * into v_report;
 return jsonb_build_object('reference',v_report.reference,
   'tracking_token',v_report.tracking_secret::text,'status',v_report.status);
end;
$$;
revoke all on function public.taxpay_record_public_issue(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.taxpay_record_public_issue(text,text,uuid,text) to service_role;
comment on table public.taxpay_public_issue_reports is
 'Nonfinancial service report, not proof of payment, ACS settlement, Treasury credit or official NBR receipt.';
