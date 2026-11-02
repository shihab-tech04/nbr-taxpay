-- Disposable local database only. Rehearses a destructive rollback
-- inside a transaction then undoes it to preserve subsequent test state.
begin;
do $$
begin
  if exists(select 1 from public.taxpay_public_issue_reports limit 1) then
    raise exception 'The rollback rehearsal requires an empty issue table';
  end if;
end;
$$;
drop function public.taxpay_record_public_issue(text,text,uuid,text);
drop table public.taxpay_public_issue_reports;
do $$
begin
  if to_regclass('public.taxpay_public_issue_reports') is not null then
    raise exception 'Rollback did not remove issue table';
  end if;
  if to_regprocedure('public.taxpay_record_public_issue(text,text,uuid,text)') is not null then
    raise exception 'Rollback did not remove intake RPC';
  end if;
end;
$$;
rollback;
do $$
begin
  if to_regclass('public.taxpay_public_issue_reports') is null
  or to_regprocedure('public.taxpay_record_public_issue(text,text,uuid,text)') is null then
    raise exception 'Rollback rehearsal failed to restore original test schema';
  end if;
end;
$$;
