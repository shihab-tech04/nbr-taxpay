\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
GRANT USAGE ON SCHEMA public TO service_role;
CREATE TABLE public.taxpay_site_banners (
  id text primary key,
  service_code text,
  heading_en text not null,
  heading_bn text not null,
  description_en text not null,
  description_bn text not null,
  mobile_heading_en text not null,
  mobile_heading_bn text not null,
  mobile_description_en text not null,
  mobile_description_bn text not null,
  action_en text not null,
  action_bn text not null,
  desktop_image_path text,
  mobile_image_path text,
  background_color text,
  heading_color text,
  body_color text,
  outline_color text,
  published boolean not null default false,
  sort_order integer not null default 0,
  version bigint not null default 1,
  updated_by uuid
);
CREATE FUNCTION public.test_banner_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.version := old.version + 1; RETURN new; END; $$;
CREATE TRIGGER test_banner_version BEFORE UPDATE ON public.taxpay_site_banners
FOR EACH ROW EXECUTE FUNCTION public.test_banner_version();
GRANT SELECT,INSERT,UPDATE,DELETE ON public.taxpay_site_banners TO service_role;
\i supabase/migrations/20261107071500_office_authenticated_taxpay_banner_bridge.sql
\i supabase/migrations/20261109152000_banner_conflict_pt409_postgrest14_retry.sql
DO $$ BEGIN
IF has_function_privilege('anon','public.taxpay_office_save_banner(jsonb,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'anon can write'; END IF;
IF has_function_privilege('authenticated','public.taxpay_office_save_banner(jsonb,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'customer can write'; END IF;
IF NOT has_function_privilege('service_role','public.taxpay_office_save_banner(jsonb,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'server denied'; END IF;
END $$;
INSERT INTO public.taxpay_site_banners (
  id, heading_en, heading_bn, description_en, description_bn,
  mobile_heading_en, mobile_heading_bn, mobile_description_en, mobile_description_bn,
  action_en, action_bn, published, sort_order
) VALUES
('intro','Intro','প্রধান','Description','বিবরণ','Intro','প্রধান','Description','বিবরণ','See','দেখুন',true,0),
('return','Return','রিটার্ন','Description','বিবরণ','Return','রিটার্ন','Description','বিবরণ','See','দেখুন',true,1);
SET ROLE service_role;
SELECT id,version,sort_order FROM public.taxpay_office_save_banner(
  '{"id":"return","service_code":"TAX_WITH_RETURN","heading_en":"Return Update","heading_bn":"রিটার্ন","description_en":"Description","description_bn":"বিবরণ","mobile_heading_en":"Return","mobile_heading_bn":"রিটার্ন","mobile_description_en":"Description","mobile_description_bn":"বিবরণ","action_en":"See","action_bn":"দেখুন","desktop_image_path":null,"mobile_image_path":null,"published":true}'::jsonb,
  1::bigint, 1::integer);
DO $$ DECLARE actual integer; ver integer; BEGIN
  SELECT sort_order,version INTO actual,ver FROM public.taxpay_site_banners WHERE id='return';
  IF actual<>0 OR ver<=1 THEN RAISE EXCEPTION 'Version/position did not persist: %, %',actual,ver; END IF;
  IF (SELECT count(*) FROM public.taxpay_site_banners WHERE id='intro' AND published)<>1
    THEN RAISE EXCEPTION 'Main banner removed'; END IF;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM public.taxpay_office_save_banner(
      '{"id":"return","published":true,"service_code":"TAX_WITH_RETURN"}'::jsonb,1,1);
    RAISE EXCEPTION 'Stale write unexpectedly allowed';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM public.taxpay_office_save_banner(
      '{"id":"intro","published":false,"service_code":null}'::jsonb,1,1);
    RAISE EXCEPTION 'Unpublishing Main banner unexpectedly allowed';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    PERFORM public.taxpay_office_save_banner('{}'::jsonb,null,1);
    RAISE EXCEPTION 'Direct non-service invocation unexpectedly allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
SELECT 'PASS: CMS bridge role, version, order and canonical banner restrictions' AS result;