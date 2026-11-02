-- Disposable Supabase only: every write is rolled back.
begin;
do $$
begin
  if to_regclass('public.taxpay_public_issue_reports') is null then
    raise exception 'Public issue table is missing';
  end if;
  if has_table_privilege('anon','public.taxpay_public_issue_reports','SELECT')
    or has_table_privilege('anon','public.taxpay_public_issue_reports','INSERT')
    or has_table_privilege('authenticated','public.taxpay_public_issue_reports','INSERT')
    or has_table_privilege('authenticated','public.taxpay_public_issue_reports','DELETE') then
    raise exception 'Public issue grants are unsafe';
  end if;
  if has_function_privilege('anon','public.taxpay_record_public_issue(text,text,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.taxpay_record_public_issue(text,text,uuid,text)','EXECUTE') then
    raise exception 'RPC must be server-only';
  end if;
end;
$$;

set local role service_role;
select public.taxpay_record_public_issue('payment',
  'A support report which has no financial ledger effect.',
  '11111111-1111-4111-8111-111111111111'::uuid,repeat('a',64));
select public.taxpay_record_public_issue('payment',
  'A support report which has no financial ledger effect.',
  '11111111-1111-4111-8111-111111111111'::uuid,repeat('a',64));
reset role;

do $$
declare
  v_count integer;
  v_ref text;
  v_status text;
begin
  select count(*),max(reference),max(status)
  into v_count,v_ref,v_status
  from public.taxpay_public_issue_reports;
  if v_count <> 1 then
    raise exception 'Idempotent retry produced % records',v_count;
  end if;
  if v_status <> 'received' then
    raise exception 'Unexpected issue status: %',v_status;
  end if;
  if v_ref !~ '^KRB-[A-F0-9]{12}$' then
    raise exception 'Invalid issue reference: %',v_ref;
  end if;
end;
$$;
rollback;
