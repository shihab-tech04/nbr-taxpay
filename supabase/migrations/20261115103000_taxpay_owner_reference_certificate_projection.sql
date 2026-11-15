-- F-129 / US-050: project immutable payment references consistently with
-- the existing Office SK-PC-{payment-id} read model.
-- A reference alone confers no ownership; both existing capability and Auth
-- owner gates remain unchanged. No issuance, settlement or financial writes.
BEGIN;

DO $reference_projection$
DECLARE
  v_func text;
  v_sql text;
  v_revised text;
  v_alias text;
  v_old text;
  v_new text;
BEGIN
  FOR v_func,v_alias IN
    SELECT f.fn,f.alias_name FROM (VALUES
      ('public.taxpay_my_story1_payment_by_reference(text,text)'::text,'q'::text),
      ('public.taxpay_demo_story1_reference_payment(text,text,text)'::text,'p'::text)
    ) f(fn,alias_name)
  LOOP
    v_sql := pg_catalog.pg_get_functiondef(v_func::regprocedure);
    IF pg_catalog.strpos(v_sql,'''certificateReference''') > 0 THEN
      RAISE EXCEPTION 'F129_REFERENCE_PROJECTION_ALREADY_PRESENT: %',v_func;
    END IF;
    v_old := '''status'','||v_alias||'.status';
    v_new := v_old ||
      ',''receiptReference'',COALESCE('||
        'NULLIF('||v_alias||'.data#>>''{details,receiptReference}'',''''),'||
        'NULLIF('||v_alias||'.data#>>''{details,receiptSnapshot,challanNo}'',''''))'||
      ',''certificateReference'',''SK-PC-''||'||v_alias||'.id::text';
    v_revised := pg_catalog.replace(v_sql,v_old,v_new);
    IF v_sql=v_revised OR
      pg_catalog.length(v_sql)-pg_catalog.length(pg_catalog.replace(v_sql,v_old,''))<>
      pg_catalog.length(v_old)
    THEN
      RAISE EXCEPTION 'F129_REFERENCE_PROJECTION_BASELINE_MISMATCH: %',v_func;
    END IF;
    EXECUTE v_revised;
    IF pg_catalog.strpos(pg_catalog.pg_get_functiondef(v_func::regprocedure),
       '''certificateReference''')=0
    THEN
      RAISE EXCEPTION 'F129_REFERENCE_PROJECTION_MISSING: %',v_func;
    END IF;
  END LOOP;
END;
$reference_projection$;

-- Retain the existing role model exactly; no guest, public or broad Auth access.
DO $reference_access$
BEGIN
  IF has_function_privilege('anon',
    'public.taxpay_my_story1_payment_by_reference(text,text)','EXECUTE') OR
     NOT has_function_privilege('authenticated',
    'public.taxpay_my_story1_payment_by_reference(text,text)','EXECUTE') OR
     has_function_privilege('anon',
    'public.taxpay_demo_story1_reference_payment(text,text,text)','EXECUTE') OR
     has_function_privilege('authenticated',
    'public.taxpay_demo_story1_reference_payment(text,text,text)','EXECUTE') OR
     NOT has_function_privilege('service_role',
    'public.taxpay_demo_story1_reference_payment(text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'F129_REFERENCE_GRANTS_CHANGED'; END IF;
END;
$reference_access$;
COMMIT;
