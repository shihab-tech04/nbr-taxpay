-- Read the correction inquiry and its append-only Office decisions for the signed-in owner.
-- This exposes review history without granting direct access to the private decision table.
BEGIN;

CREATE OR REPLACE FUNCTION public.taxpay_correction_my_history(p_limit integer DEFAULT 50)
RETURNS TABLE (
  inquiry_id uuid,
  event_id uuid,
  event_kind text,
  revision integer,
  action_code text,
  actor_role text,
  source_system text,
  previous_state text,
  next_state text,
  reason text,
  occurred_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATED_USER_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid correction history limit';
  END IF;

  RETURN QUERY
  WITH owner_inquiries AS (
    SELECT i.inquiry_id,i.created_at,i.reason
    FROM public.taxpay_correction_inquiries i
    WHERE i.requester_uid=v_actor
    ORDER BY i.created_at DESC,i.inquiry_id DESC
    LIMIT p_limit
  ),
  decision_events AS (
    SELECT d.inquiry_id,d.message_id,
      CASE d.previous_state
        WHEN 'PENDING_OFFICER' THEN 2
        WHEN 'MAKER_ACKNOWLEDGED' THEN 3
        WHEN 'REVIEWER_VERIFIED' THEN 4
      END::integer AS revision,
      d.action_code,d.officer_role,d.previous_state,d.next_state,d.reason,d.created_at
    FROM public.taxpay_correction_review_decisions d
    JOIN owner_inquiries i ON i.inquiry_id=d.inquiry_id
  ),
  history AS (
    SELECT i.inquiry_id,i.inquiry_id AS event_id,
      'INQUIRY_SUBMITTED'::text AS event_kind,1::integer AS revision,
      'SUBMITTED'::text AS action_code,'TAXPAYER'::text AS actor_role,
      'TAXPAY_SQL'::text AS source_system,NULL::text AS previous_state,
      'PENDING_OFFICER'::text AS next_state,i.reason,i.created_at AS occurred_at
    FROM owner_inquiries i
    UNION ALL
    SELECT d.inquiry_id,d.message_id,'OFFICE_DECISION'::text,d.revision,
      d.action_code,d.officer_role,'OFFICE_SQL'::text,d.previous_state,
      d.next_state,d.reason,d.created_at
    FROM decision_events d
  )
  SELECT h.inquiry_id,h.event_id,h.event_kind,h.revision,h.action_code,
    h.actor_role,h.source_system,h.previous_state,h.next_state,h.reason,h.occurred_at
  FROM history h
  ORDER BY h.occurred_at,h.revision,h.event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.taxpay_correction_my_history(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_my_history(integer)
  TO authenticated;

COMMENT ON FUNCTION public.taxpay_correction_my_history(integer) IS
  'Returns the latest correction inquiry events only for auth.uid(); preserves decision IDs, actors, source, state transitions and timestamps without granting direct access to the private audit table.';

COMMIT;
