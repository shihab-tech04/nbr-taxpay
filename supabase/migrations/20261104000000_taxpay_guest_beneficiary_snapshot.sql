-- One capability-scoped read replaces two network/RPC calls and two session
-- touches. Keep the existing 500-row cursor boundary and historical row shape.
create function public.taxpay_guest_beneficiary_snapshot(p_capability_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $$
declare
  v_session_id uuid;
  v_lists jsonb;
  v_people jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'created_at', created_at
  ) order by lower(name), id), '[]'::jsonb)
    into v_lists
    from taxpay_guest_private.lists
   where session_id = v_session_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'list_id', list_id, 'tin', tin, 'display_name', display_name,
    'tag', tag, 'relationship', relationship, 'other_label', other_label,
    'created_at', created_at, 'updated_at', updated_at
  ) order by created_at desc, id desc), '[]'::jsonb)
    into v_people
    from (
      select id, list_id, tin, display_name, tag, relationship, other_label,
             created_at, updated_at
        from taxpay_guest_private.beneficiaries
       where session_id = v_session_id
       order by created_at desc, id desc
       limit 500
    ) page;

  return jsonb_build_object('lists', v_lists, 'people', v_people);
end;
$$;

-- The browser must never call this SECURITY DEFINER function directly. Only
-- the existing guest Edge Function holds its service-side DB capability.
revoke all on function public.taxpay_guest_beneficiary_snapshot(text) from public, anon, authenticated;
grant execute on function public.taxpay_guest_beneficiary_snapshot(text) to service_role;
