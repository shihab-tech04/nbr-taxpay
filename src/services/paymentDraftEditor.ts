import type { PaymentFormDraft } from './accountPaymentFormDrafts';

/** Choose the renderer, not a new payment service or a rewritten SQL draft.
 * Dashboard/modern Pay Tax can open compatible schema-1 snapshots even if they
 * predate the v5 marker. Versioned Return is valid too. Other legacy service
 * payloads and Travel Tax must not be misinterpreted as grouped allocations.
 */
export function useUnifiedDraftEditor(draft: Pick<PaymentFormDraft,'service'|'form_payload'>, modernEntry: boolean): boolean {
  const payload=draft.form_payload;
  return payload.schemaVersion===1 && payload.category===draft.service &&
    (draft.service==='TAX_WITH_RETURN'||draft.service==='OTHER_TAX_PAYMENT') &&
    (payload.unifiedFlowVersion===5 || (modernEntry && payload.unifiedFlowVersion===undefined));
}
