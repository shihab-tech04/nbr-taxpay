-- Run against disposable local Supabase only. ALL inserted reports roll back.
begin;
do $$
begin
 if to_regclass('public.taxpay_public_issue_reports') is null then
   raise exception 'Public issue intake table missing';
 end if;
 if has_table_privilege('anon','public.taxpay_public_issue_reports','SELECT')
   or has_table_privilege('anon','public.taxpay_public_issue_reports','INSERT')
   or has_table_privilege('authenticated','public.taxpay_public_issue_reports','INSERT')
   or has_table_privilege('authenticated','public.taxpay_public_issue_reports','DELETE') then
   raise exception 'Public issue table privilege leak';
 end if;
 if has_function_privilege('anon','public.taxpay_record_public_issue(text,text,uuid,text)','EXECUTE')
   or has_function_privilege('authenticated','public.taxpay_record_public_issue(text,text,uuid,text)','EXECUTE') then
   raise exception 'Unmediated public issue RPC execution';
 end if;
end $$;
set local role service_role;
select public.taxpay_record_public_issue('payment','A support report which has no financial ledger effect.',
 '11111111-1111-4111-8111-111111111111'::uuid, repeat('a',64));
select public.taxpay_record_public_issue('payment','A support report which has no financial ledger effect.',
 '11111111-1111-4111-8111-111111111111'::uuid, repeat('a',64));
reset role;
do $$
begin
 if (select count(*) from public.taxpay_public_issue_reports) <> 1 then
   raise exception 'Idempotent retry created duplicate issue';
 end if;
 if (select status from public.taxpay_public_issue_reports limit 1) <> 'received' then
   raise exception 'Report status was not received';
 end if;
 if (select reference from public.taxpay_public_issue_reports limit 1) !~ '^KRB-[A-F0-9]{12}
end $$;
rollback;
 then
   raise exception 'Public issue reference was not generated';
 end if;
end $$;
rollback;
