-- Restore the pre-release authorization trigger without changing stored payments.
CREATE OR REPLACE FUNCTION demo_payment.validate_demo_authorized_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_payer text; v_lines jsonb; v_line jsonb; v_beneficiary text;
 v_auth uuid; v_amount bigint; v_sum bigint:=0;
BEGIN
 v_payer:=new.data->'details'->>'payerId';
 if v_payer is null then return new;end if;
 if v_payer !~ '^user([1-9]|[12][0-9]|30)$' or
   not exists(select 1 from public.sim_payment_users where id=v_payer)
   then raise exception 'INVALID_DEMO_PAYER';end if;
 v_lines:=new.data->'details'->'lines';
 if jsonb_typeof(v_lines)<>'array' or jsonb_array_length(v_lines) not between 1 and 20
   then raise exception 'INVALID_BENEFICIARY_LINES';end if;
 for v_line in select value from jsonb_array_elements(v_lines) loop
   v_beneficiary:=v_line->>'beneficiary';
   if not exists(select 1 from public.sim_payment_users where id=v_beneficiary)
     then raise exception 'INVALID_BENEFICIARY';end if;
   if coalesce(v_line->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
     then raise exception 'INVALID_ALLOCATION_AMOUNT';end if;
   v_amount:=(v_line->>'amountMinor')::bigint;v_sum:=v_sum+v_amount;
   if v_beneficiary<>v_payer then
     if coalesce(v_line->>'authorizationId','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       then raise exception 'AUTHORIZATION_REQUIRED';end if;
     v_auth:=(v_line->>'authorizationId')::uuid;
     if not exists(select 1 from public.demo_authorization_requests a
       where a.id=v_auth and a.payer_id=v_payer and a.taxpayer_id=v_beneficiary
         and a.status='ACTIVE') then raise exception 'AUTHORIZATION_REQUIRED';end if;
   end if;
 end loop;
 if v_sum<>new.amount_minor then raise exception 'ALLOCATION_TOTAL_MISMATCH';end if;
 return new;
END;
$function$;
