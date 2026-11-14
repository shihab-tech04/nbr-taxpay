\set ON_ERROR_STOP on

-- Isolated starting point matching the pre-release logo table constraint.
CREATE TABLE public.taxpay_site_logo (
  id text primary key default 'primary' check (id = 'primary'),
  image_path text,
  image_width integer,
  image_height integer,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  CONSTRAINT taxpay_site_logo_dimensions_check CHECK (
    (image_path IS NULL AND image_width IS NULL AND image_height IS NULL)
    OR (
      image_path ~ '^logos/[a-f0-9-]{36}\.(png|jpg|webp)$'
      AND image_width BETWEEN 600 AND 6000
      AND image_height BETWEEN 120 AND 2000
      AND image_width::numeric / NULLIF(image_height, 0)::numeric BETWEEN 3.5 AND 6.5
    )
  )
);

\i supabase/migrations/20261107165907_taxpay_site_logo_crop_dimensions_20261107.sql

-- Copy the actual post-migration check to an isolated table, then exercise it.
CREATE TEMP TABLE cms_logo_dimension_test (
  LIKE public.taxpay_site_logo INCLUDING CONSTRAINTS INCLUDING DEFAULTS
);

INSERT INTO cms_logo_dimension_test (id, image_path, image_width, image_height)
VALUES ('primary', 'logos/00000000-0000-0000-0000-000000000001.png', 1469, 496);

DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    UPDATE cms_logo_dimension_test
    SET image_path = 'logos/00000000-0000-0000-0000-000000000002.png',
        image_width = 1000,
        image_height = 400;
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'Out-of-range logo aspect ratio was accepted';
  END IF;
END $$;

DO $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    UPDATE cms_logo_dimension_test
    SET image_path = 'logos/00000000-0000-0000-0000-000000000003.png',
        image_width = 5000,
        image_height = 500;
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'The existing upper aspect-ratio bound was not preserved';
  END IF;
END $$;

SELECT 'PASS: approved 1469 x 496 crop persists; invalid aspect ratios remain rejected' AS result;
