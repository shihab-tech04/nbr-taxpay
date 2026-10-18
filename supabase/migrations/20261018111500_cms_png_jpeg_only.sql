-- New logo and banner uploads must be PNG or JPEG (both .jpg and .jpeg).
-- Existing published WebP assets remain readable: this restriction applies
-- to future Storage writes only and does not rewrite or delete past objects.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg']::text[]
where id in ('taxpay-branding', 'taxpay-banners');
