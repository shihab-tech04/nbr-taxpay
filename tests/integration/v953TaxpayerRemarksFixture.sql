-- F-178/US-181: disposable PostgreSQL 17 only, no hosted finance write.
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA demo_payment;
CREATE TABLE demo_payment.story_payments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key uuid NOT NULL UNIQUE,
 session_id uuid NOT NULL,
 service_code text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 status text NOT NULL DEFAULT 'SIMULATED_SUCCESS' CHECK(status='SIMULATED_SUCCESS'),
 created_at timestamptz NOT NULL DEFAULT now()
);
