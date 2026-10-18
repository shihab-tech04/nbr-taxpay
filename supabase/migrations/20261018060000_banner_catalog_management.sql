-- The Office 'admin' ID editor can create any number of banner records.
-- Like the existing anonymous edit policies, this intentionally offers no
-- server-verifiable identity check (temporary user-approved login model).
grant insert on public.taxpay_site_banners to anon;

drop policy if exists "office id only adds banners" on public.taxpay_site_banners;
create policy "office id only adds banners"
on public.taxpay_site_banners for insert to anon
with check (updated_by is null);

-- Keep at least one banner in the catalog AND one visible on TaxPay.
-- A shared transaction lock also protects two simultaneous unpublish/delete
-- requests from independently removing the last published banner.
create or replace function public.taxpay_preserve_banner_minimum()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(58007001);
  if tg_op = 'DELETE' then
    if (select count(*) from public.taxpay_site_banners) <= 1 then
      raise exception 'At least one banner must remain.';
    end if;
    if old.published and (select count(*) from public.taxpay_site_banners where published) <= 1 then
      raise exception 'At least one published banner must remain.';
    end if;
    return old;
  end if;

  if old.published and not new.published
    and (select count(*) from public.taxpay_site_banners where published) <= 1 then
    raise exception 'At least one published banner must remain.';
  end if;
  return new;
end;
$$;

drop trigger if exists taxpay_banner_keep_minimum on public.taxpay_site_banners;
create trigger taxpay_banner_keep_minimum
before delete or update of published on public.taxpay_site_banners
for each row execute function public.taxpay_preserve_banner_minimum();

-- Move any existing or newly inserted banner to a 1-based serial position.
-- Renumber the catalog in one transaction, preserving a deterministic order
-- regardless of how many banners have been added or removed.
create or replace function public.taxpay_set_banner_position(p_banner_id text, p_position integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  all_ids text[];
  other_ids text[];
  ordered_ids text[] := array[]::text[];
  total_count integer;
  new_position integer;
  i integer;
begin
  perform pg_advisory_xact_lock(58007001);
  select array_agg(id order by sort_order, id)
    into all_ids from public.taxpay_site_banners;
  if all_ids is null or not p_banner_id = any(all_ids) then
    raise exception 'Banner not found.';
  end if;
  total_count := cardinality(all_ids);
  new_position := greatest(1, least(coalesce(p_position, total_count), total_count));
  other_ids := array_remove(all_ids, p_banner_id);

  for i in 1..total_count loop
    if i = new_position then
      ordered_ids := array_append(ordered_ids, p_banner_id);
    elsif i < new_position then
      ordered_ids := array_append(ordered_ids, other_ids[i]);
    else
      ordered_ids := array_append(ordered_ids, other_ids[i - 1]);
    end if;
  end loop;

  for i in 1..total_count loop
    update public.taxpay_site_banners
      set sort_order = i - 1, updated_by = null
      where id = ordered_ids[i] and sort_order is distinct from i - 1;
  end loop;
end;
$$;

revoke all on function public.taxpay_set_banner_position(text, integer) from public;
grant execute on function public.taxpay_set_banner_position(text, integer) to anon, authenticated;
