-- TaxPay Module 01 public issue intake: targeted, nonfinancial rollback.
-- Run ONLY when rollback is approved and the support table is EMPTY.
-- Real submissions must first be exported, preserved and a dedicated migration
-- designed; deleting submitted reports is prohibited.
begin;
do $$
begin
  if to_regclass('public.taxpay_public_issue_reports') is null then
    raise exception 'Target issue table does not exist: rollback not applicable';
  end if;
  if exists (select 1 from public.taxpay_public_issue_reports limit 1) then
    raise exception 'Public reports exist: preserve all reports before rollback';
  end if;
end;
$$;
drop function public.taxpay_record_public_issue(text,text,uuid,text);
drop table public.taxpay_public_issue_reports;
commit;
-- Additive migration touches no existing payment, credit, banner, auth, or
-- taxpayer table. This rollback only removes the two introduced objects.
