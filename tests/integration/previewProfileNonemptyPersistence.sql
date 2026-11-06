-- Runnable only on the disposable local Supabase project.
-- A real SQL write/read test: no mocked HTTP, no pre-existing nonempty records needed.
-- ROLLBACK preserves every existing account, beneficiary, setting and payment.
begin;
do $account$
declare
  first_login jsonb;
  second_login jsonb;
  other_login jsonb;
  first_hash text;
  other_hash text;
  new_list uuid;
  new_tin constant text := '919191919191';
  data jsonb;
  written integer;
begin
  first_login := public.taxpay_demo_profile_login('user9','user9');
  other_login := public.taxpay_demo_profile_login('user10','user10');
  first_hash := encode(extensions.digest(convert_to(first_login->>'capability','UTF8'),'sha256'),'hex');
  other_hash := encode(extensions.digest(convert_to(other_login->>'capability','UTF8'),'sha256'),'hex');

  if first_login->>'capability' = other_login->>'capability'
     or first_login->>'paymentSessionId' = other_login->>'paymentSessionId' then
    raise exception 'Different User IDs share a profile capability or payment session';
  end if;

  new_list := (public.taxpay_guest_beneficiary_create_list(first_hash,'Acceptance rollback only')->>'id')::uuid;
  written := public.taxpay_guest_beneficiary_add(first_hash,new_list,
     '[{"tin":"919191919191","display_name":"Rollback-only account record","tag":"clients"}]'::jsonb);
  if written <> 1 then raise exception 'Nonempty saved-beneficiary write failed: %',written; end if;

  data := public.taxpay_guest_beneficiary_rows(first_hash,0,500);
  if not exists(select 1 from jsonb_array_elements(data) item
    where item->>'tin'=new_tin and item->>'list_id'=new_list::text
      and item->>'tag'='clients') then
    raise exception 'The first account cannot read its saved beneficiary';
  end if;
  if not exists(select 1 from jsonb_array_elements(public.taxpay_guest_beneficiary_lists(first_hash)) item
    where item->>'id'=new_list::text) then
    raise exception 'The first account cannot read its new saved list';
  end if;
  if exists(select 1 from jsonb_array_elements(public.taxpay_guest_beneficiary_rows(other_hash,0,500)) item
    where item->>'tin'=new_tin) then
    raise exception 'Different account read the first account beneficiary';
  end if;
  if exists(select 1 from jsonb_array_elements(public.taxpay_guest_beneficiary_lists(other_hash)) item
    where item->>'id'=new_list::text) then
    raise exception 'Different account read the first account list';
  end if;

  data := public.taxpay_demo_profile_settings(first_hash,'selected-list',new_list::text);
  if data->>'selectedListId' is distinct from new_list::text then
    raise exception 'Selected-list write failed';
  end if;
  data := public.taxpay_demo_profile_settings(first_hash,'language','bn');
  if data->>'language' is distinct from 'bn' then raise exception 'Language write failed'; end if;

  -- A fresh login must rehydrate SQL state, not merely a browser variable.
  second_login := public.taxpay_demo_profile_login('user9','user9');
  if second_login->>'capability' is distinct from first_login->>'capability'
     or second_login->>'paymentSessionId' is distinct from first_login->>'paymentSessionId'
     or second_login->>'language' is distinct from 'bn'
     or second_login->>'selectedListId' is distinct from new_list::text then
    raise exception 'Fresh-browser profile state or payment session did not persist';
  end if;

  begin
    perform public.taxpay_demo_profile_settings(other_hash,'selected-list',new_list::text);
    raise exception 'Cross-account selected-list modification was accepted';
  exception when others then
    if sqlerrm = 'Cross-account selected-list modification was accepted' then raise; end if;
    if sqlerrm not like '%INVALID_LIST%' then raise; end if;
  end;
  if public.taxpay_guest_beneficiary_add(other_hash,new_list,
    '[{"tin":"919191919192","display_name":"Forbidden","tag":"clients"}]'::jsonb) <> 0 then
    raise exception 'Different account was allowed to add to first account list';
  end if;

  raise notice 'PASS: nonempty durable list, tagged beneficiary, language, selected list, second login and other-user isolation';
end
$account$;
rollback;
