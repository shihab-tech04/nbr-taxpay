# TaxPay browser backend status

The public source does not embed a hosted Supabase URL or browser key. The client stays disabled unless an endpoint and publishable key are explicitly supplied. GitHub Pages builds set `VITE_SUPABASE_DISABLED=true`; they contain no hosted backend configuration, sign-in, or saved-draft service.

For local synthetic verification, use only the disposable Supabase stack on loopback and pass its URL and anon/publishable key through the local shell. Do not use production taxpayer, payment, or HR services. Never place a secret or service-role key in browser code.

## Open local persistence discrepancy

The Mac synthetic integration checkpoint recorded successful Auth and PostgREST HTTP responses, including a second HTTP read of the inserted draft, while a direct PostgreSQL query did not find the same inserted row. The root cause remains unresolved. Migration reset also previously failed because the initial table already existed; migrations were applied manually and migration bookkeeping still needs independent verification. These results do not establish durable persistence, production readiness, or BL-03 certification.

Until that discrepancy is resolved, authenticated drafts, source-change proposals, and correction inquiries are unavailable in the public static preview. Payment execution, legal calculations, eTIN validation, Treasury settlement, and tax-credit posting remain unavailable.
