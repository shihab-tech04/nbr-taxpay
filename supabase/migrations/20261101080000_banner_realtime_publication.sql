-- Banner CMS Realtime delivery. Public visibility remains governed by existing RLS.
-- Office CMS writes remain limited to verified administrators.
-- Preserve foreground/focus/poll reconciliation for missed notifications.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'taxpay_site_banners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.taxpay_site_banners;
  END IF;
END $$;
