-- M04 F-026 through F-031: new-return RPC validator, forward-only.
-- Keeps all prior parent, receipt, grants, RLS and non-Return contracts.
BEGIN;
CREATE OR REPLACE FUNCTION demo_payment.assert_new_head_exclusivity(p_input jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $taxpay_return$
DECLARE
  v_service text := p_input->>'service';
  v_details jsonb := p_input->'details';
  v_lines jsonb := p_input#>'{details,lines}';
  v_snapshot jsonb := p_input#>'{details,receiptSnapshot}';
  v_year text := p_input#>>'{details,assessmentYear}';
  v_tin text := p_input#>>'{details,taxpayerTin}';
  v_value text := p_input->>'amountMinor';
BEGIN
  IF v_service = 'TAX_WITH_RETURN' THEN
    IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT';
    END IF;
    IF jsonb_array_length(v_lines) <> 1
       OR v_lines->0->>'headId' IS DISTINCT FROM '125'
       OR (v_lines->0 ? 'category' AND v_lines->0->>'category' IS DISTINCT FROM 'TAX_WITH_RETURN')
       OR v_details->>'combinedPayment' IS NOT NULL
       OR v_details ? 'allocations'
       OR v_details ? 'additionalTaxpayers'
       OR v_details ? 'otherTaxLines'
    THEN RAISE EXCEPTION 'RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT'; END IF;
    IF coalesce(v_tin,'') !~ '^[0-9]{12,13}$'
       OR coalesce(v_year,'') !~ '^20[0-9]{2}-[0-9]{2}$'
       OR right(v_year,2)::integer <> (left(v_year,4)::integer + 1) % 100
       OR coalesce(p_input#>>'{details,payerMode}','') NOT IN ('SELF','OTHER')
       OR coalesce(v_value,'') !~ '^[1-9][0-9]{0,11}$'
    THEN RAISE EXCEPTION 'RETURN_EXCLUSIVE_IDENTITY_YEAR_AMOUNT'; END IF;
    IF jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
       OR v_snapshot->>'paymentCategory' IS DISTINCT FROM 'TAX_WITH_RETURN'
       OR v_snapshot->>'taxpayerTin' IS DISTINCT FROM v_tin
       OR v_snapshot->>'assessmentYear' IS DISTINCT FROM v_year
       OR jsonb_typeof(v_snapshot->'items') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'RETURN_EXCLUSIVE_RECEIPT_MISMATCH'; END IF;
    IF jsonb_array_length(v_snapshot->'items') <> 1
       OR v_snapshot->'items'->0->>'headId' IS DISTINCT FROM '125'
       OR v_snapshot->>'challanNo' IS DISTINCT FROM v_details->>'receiptReference'
       OR coalesce(v_snapshot->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       OR coalesce(v_lines->0->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       OR coalesce(v_snapshot->'items'->0->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       OR v_snapshot->>'payerTin' IS DISTINCT FROM v_details->>'payerTin'
    THEN RAISE EXCEPTION 'RETURN_EXCLUSIVE_RECEIPT_MISMATCH'; END IF;
    IF (v_snapshot->>'totalAmount')::numeric*100 <> v_value::numeric
       OR (v_lines->0->>'totalAmount')::numeric*100 <> v_value::numeric
       OR (v_snapshot->'items'->0->>'totalAmount')::numeric*100 <> v_value::numeric
    THEN RAISE EXCEPTION 'RETURN_EXCLUSIVE_TOTAL_MISMATCH'; END IF;
  ELSIF jsonb_typeof(v_lines) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) AS a(value)
    WHERE a.value->>'category' = 'TAX_WITH_RETURN' OR a.value->>'headId' = '125'
  ) THEN
    RAISE EXCEPTION 'RETURN_HEAD_EXCLUSIVE';
  END IF;
END;
$taxpay_return$;
REVOKE ALL ON FUNCTION demo_payment.assert_new_head_exclusivity(jsonb) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION demo_payment.assert_new_head_exclusivity(jsonb) IS
 'M04: only one 125 Return head, beneficiary and valid AY per new RPC parent; receipt source and total must match. Existing rows unchanged.';
COMMIT;
