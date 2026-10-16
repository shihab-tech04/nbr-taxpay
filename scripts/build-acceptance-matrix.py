#!/usr/bin/env python3
"""Build the versioned TaxPay requirement-to-route-to-test matrix.

Run with the accepted story tracker CSV as input:
  python3 scripts/build-acceptance-matrix.py /path/to/story-tracker.csv

The original tracker is kept as a Library source. This script does not rewrite
story wording and starts every in-scope story as UNVERIFIED unless an external
dependency is already known to block full acceptance.
"""
import csv
import pathlib
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: build-acceptance-matrix.py STORY_TRACKER.csv")

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(__file__).resolve().parents[1] / "docs" / "acceptance-matrix.csv"

routes = {
    "CAT": "head_catalogue; guest; guestwh; wizard",
    "COR": "corrections; history; account_notifications",
    "IDN": "taxpayer_login; taxpayer_home; dashboard; private taxpayer routes",
    "LDG": "ledger; history; dashboard; journey",
    "OBL": "dashboard; journey; wizard; ledger",
    "OFF": "OUT OF TAXPAY SCOPE",
    "PAY": "guest; guestwh; wizard; payment_details; history",
    "PLT": "all registered TaxPay routes; GitHub Pages release workflow",
    "PUB": "landing; user_guide; guest; guestwh; travel; verify",
    "QAG": "all registered TaxPay routes; tests and release workflow",
    "RCP": "verify; payment_details; history",
    "SEM": "routes declared by each story's feature/module",
    "TAX": "taxpayer_home; dashboard; journey; ledger; certificates",
    "TRS": "guest; guestwh; wizard; history; payment_details",
    "TVL": "travel",
    "UX": "all registered public and taxpayer routes",
    "WHT": "guestwh; wizard; history; ledger; payment_details",
    "KNW": "user_guide; glossary; guidance; head_catalogue",
    "INC": "incident; account_notifications",
    "PAR": "page named by the story; route matrix in FEATURE_PARITY_v11.md",
    "E2E": "end-to-end routes named by the story scenario",
}

tests = {
    "CAT": "tests/v11SourceHeads.test.ts; tests/e2e/head-catalogue.spec.ts; tests/e2e/explore-payment-flow.spec.ts",
    "COR": "tests/correctionInquiryValidation.test.ts; tests/e2e/secure-workspace-correction-retry.spec.ts",
    "IDN": "tests/e2e/taxpay-login-real-auth.spec.ts; tests/e2e/taxpay-password-local-auth.spec.ts; tests/e2e/secure-workspace-session-isolation.spec.ts; tests/production/production-auth-boundary.spec.ts; tests/integration/localSupabaseHttp.mjs",
    "LDG": "tests/e2e/payment-review-release.spec.ts; tests/e2e/user1-dashboard-financial-ux.spec.ts; tests/taxpayerEvidence.test.ts",
    "OBL": "tests/e2e/payment-review-release.spec.ts; tests/e2e/user1-dashboard-financial-ux.spec.ts; tests/e2e/public-financial-safety.spec.ts",
    "OFF": "OUT OF TAXPAY SCOPE",
    "PAY": "tests/e2e/payment-review-release.spec.ts; tests/e2e/backend-boundary.spec.ts; tests/demo-mixed-payments.test.ts; tests/integration/simulatedPaymentAcceptance.sql",
    "PLT": "tests/routeContract.test.ts; tests/privateRoutePolicy.test.ts; .github/workflows/pages.yml; .github/workflows/phase02-local-supabase.yml",
    "PUB": "tests/e2e/citizen-navigation.spec.ts; tests/e2e/public-guest-guide.spec.ts; tests/e2e/public-financial-safety.spec.ts; tests/e2e/public-backend-disabled.spec.ts",
    "QAG": "tests/*.test.ts; tests/e2e/*.spec.ts; tests/production/production-auth-boundary.spec.ts; GitHub Actions",
    "RCP": "tests/e2e/navigation-integrity.spec.ts; tests/e2e/public-financial-safety.spec.ts; tests/production/production-auth-boundary.spec.ts",
    "SEM": "tests/auditDisclosure.test.ts; tests/v11SourceHeads.test.ts; tests/routeContract.test.ts",
    "TAX": "tests/e2e/payment-review-release.spec.ts; tests/e2e/taxpayer-account-integrity.spec.ts; tests/taxpayerEvidence.test.ts",
    "TRS": "tests/e2e/payment-review-release.spec.ts; tests/e2e/backend-boundary.spec.ts; tests/integration/simulatedPaymentAcceptance.sql; tests/integration/localSupabaseHttp.mjs",
    "TVL": "tests/e2e/public-financial-safety.spec.ts; tests/e2e/navigation-integrity.spec.ts; tests/production/production-auth-boundary.spec.ts",
    "UX": "tests/e2e/citizen-keyboard-comprehensive.spec.ts; tests/e2e/taxpayer-reference-design.spec.ts; tests/e2e/taxpayer-account-center.spec.ts",
    "WHT": "tests/e2e/payment-review-release.spec.ts; tests/demo-mixed-payments.test.ts; tests/integration/simulatedPaymentAcceptance.sql",
    "KNW": "tests/e2e/citizen-navigation.spec.ts; tests/e2e/public-guest-guide.spec.ts; tests/e2e/public-financial-safety.spec.ts",
    "INC": "tests/e2e/backend-boundary.spec.ts; tests/correctionInquiryValidation.test.ts",
    "PAR": "tests/e2e/citizen-page-matrix.spec.ts; tests/e2e/navigation-integrity.spec.ts; tests/e2e/taxpayer-reference-design.spec.ts",
    "E2E": "tests/e2e/*.spec.ts; isolated backend tests where applicable",
}

out_of_scope_modules = {"OFF"}
out_of_scope_ids = {"TPAY-US-E2E-012", "TPAY-US-E2E-015"}

def disposition(row):
    sid, module = row["story_id"], row["module_id"]
    if module in out_of_scope_modules or sid in out_of_scope_ids:
        return "OUT_OF_SCOPE", "Separate NBR Office Management scope, excluded by current TaxPay release instruction."
    if sid in {"TPAY-US-E2E-010", "TPAY-US-E2E-011"}:
        return "BLOCKED", "Full journey requires the separate Office Management or investigation system; TaxPay cannot complete that external step."
    if module == "TVL":
        return "BLOCKED", "Production uses the NBR-linked Sonali Bank collection page; TaxPay has no authorized travel-tax sandbox, approved rate fixture, or verified collection callback."
    if module == "RCP":
        return "BLOCKED", "Production links to official iBAS++ eServices; a verified TaxPay receipt/challan lookup API or sandbox is not connected."
    if module == "TRS":
        return "BLOCKED", "The app has a local simulation only; no official payment gateway/Treasury sandbox or verified production callback is connected."
    if module == "IDN" and ("IDN-007" in sid or "IDN-008" in sid or "IDN-009" in sid):
        return "BLOCKED", "External eTIN/MFA/production ownership authorization and a real production account-owner sign-in are not available for end-to-end acceptance."
    if module in {"OBL", "TAX"}:
        return "BLOCKED", "Approved authoritative legal/financial test fixtures and verified NBR/eReturn data are not available; this story cannot be certified from sample calculations."
    if row["source_basis"] == "CROSS_FEATURE_TEST_DESIGN_REQUIRES_APPROVAL":
        return "BLOCKED", "The source tracker explicitly requires owner approval for this cross-feature test design."
    if "required external authority before activation" in row["release_gates"].lower():
        return "BLOCKED", "The accepted story release gate requires external authority/access that is not configured in this release."
    return "UNVERIFIED", "Mapped to candidate route and suite; PASS requires an executed assertion with evidence for this story, not source inspection."

fields = [
    "story_id", "kind", "module_id", "feature_id", "epic", "title", "persona",
    "user_story", "scenario", "expected_result", "negative_or_boundary", "source_basis",
    "source_locator", "scope", "candidate_route", "candidate_test_suite", "status",
    "status_reason", "evidence_commit", "test_run_url",
]

with source.open(newline="", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))
if len(rows) != 387 or len({r["story_id"] for r in rows}) != 387:
    raise SystemExit(f"expected exactly 387 unique source stories; got {len(rows)} rows")

target.parent.mkdir(parents=True, exist_ok=True)
with target.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows:
        status, reason = disposition(row)
        writer.writerow({
            "story_id": row["story_id"], "kind": row["kind"], "module_id": row["module_id"],
            "feature_id": row["feature_id"], "epic": row["epic"], "title": row["title"],
            "persona": row["persona"], "user_story": row["user_story"], "scenario": row["scenario"],
            "expected_result": row["then"], "negative_or_boundary": row["negative_or_boundary"],
            "source_basis": row["source_basis"], "source_locator": row["source_locator"],
            "scope": "OUT_OF_SCOPE" if status == "OUT_OF_SCOPE" else "REQUIRED",
            "candidate_route": routes.get(row["module_id"], "route review required"),
            "candidate_test_suite": tests.get(row["module_id"], "suite mapping required"),
            "status": status, "status_reason": reason,
            "evidence_commit": "", "test_run_url": "",
        })
print(f"Wrote {len(rows)} story rows to {target}")
