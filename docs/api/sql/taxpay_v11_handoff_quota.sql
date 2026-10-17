-- Resource guard for the publicly callable fictional-handoff creation API.
-- It does not grant access to any financial or taxpayer table.
create or replace function taxpay_handoff.enforce_public_sample_quota()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_global integer;v_session integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(763981240156::bigint);
  select count(*) into v_global from taxpay_handoff.requests
    where created_at>now()-interval '1 hour';
  select count(*) into v_session from taxpay_handoff.requests
    where session_id=new.session_id and created_at>now()-interval '1 hour';
  if v_global>=200 or v_session>=30 then
    raise exception 'HANDOFF_RATE_LIMIT';
  end if;
  return new;
end;
$function$;
revoke all on function taxpay_handoff.enforce_public_sample_quota()
  from public,anon,authenticated;
do $block$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='taxpay_handoff' and c.relname='requests'
      and t.tgname='taxpay_handoff_quota_insert'
  ) then
    create trigger taxpay_handoff_quota_insert
      before insert on taxpay_handoff.requests for each row
      execute function taxpay_handoff.enforce_public_sample_quota();
  end if;
end;
$block$;
