-- Match the database range to the approved Office crop and existing TaxPay logo slots.
-- The cropper publishes 1469 x 496 (aspect ratio 2.9617); header/sidebar slots are
-- approximately 2.83–2.96. The old 3.5 lower bound rejected every approved crop.
ALTER TABLE public.taxpay_site_logo
  DROP CONSTRAINT IF EXISTS taxpay_site_logo_dimensions_check;

ALTER TABLE public.taxpay_site_logo
  ADD CONSTRAINT taxpay_site_logo_dimensions_check CHECK (
    (image_path IS NULL AND image_width IS NULL AND image_height IS NULL)
    OR (
      image_path ~ '^logos/[a-f0-9-]{36}\.(png|jpg|webp)$'
      AND image_width BETWEEN 600 AND 6000
      AND image_height BETWEEN 120 AND 2000
      AND image_width::numeric / NULLIF(image_height, 0)::numeric BETWEEN 2.8 AND 6.5
    )
  );
