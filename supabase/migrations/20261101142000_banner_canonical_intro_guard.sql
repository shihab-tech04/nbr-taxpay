-- Protect the frozen, SQL-controlled homepage copy source.
-- The Intro banner is the sole canonical fixed-content record even when
-- administrators add further service artwork. This cannot be deleted,
-- renamed, unpublished, or assigned a service category.
create or replace function public.taxpay_preserve_canonical_intro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.id = 'intro' then
      raise exception 'The canonical Main banner cannot be deleted.'
        using errcode = '23514';
    end if;
    return old;
  end if;
  if old.id = 'intro' and
     (new.id is distinct from 'intro'
      or new.service_code is not null
      or new.published is distinct from true) then
    raise exception 'The canonical Main banner must remain published and uncategorized.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists taxpay_banner_preserve_canonical_intro
  on public.taxpay_site_banners;

create trigger taxpay_banner_preserve_canonical_intro
before update or delete on public.taxpay_site_banners
for each row
when (old.id = 'intro')
execute function public.taxpay_preserve_canonical_intro();

comment on function public.taxpay_preserve_canonical_intro()
  is 'Preserves the canonical Main banner used by the fixed TaxPay hero copy, including through Admin CRUD and direct SQL writes.';
