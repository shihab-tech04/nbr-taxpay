-- F-178/US-181: disposable PostgreSQL 17 only, no hosted finance write.
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA demo_payment;
CREATE TABLE demo_payment.story_payments(
 id uuid PRIMARY KEY,
 data jsonb NOT NULL
);
