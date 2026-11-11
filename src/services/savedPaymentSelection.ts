import type { PaymentFormDraft } from './accountPaymentFormDrafts';
import type { Beneficiary } from './beneficiaries';
import { beneficiaryNameForPrefill } from './beneficiaryNames';

export type SelectedPaymentBeneficiary = { tin: string; name: string };

/** Recover the most recently saved *payment* selection, not arbitrary guest
 * list records. Use only owner-scoped drafts returned by the verified draft API;
 * match TINs to that same owner's currently saved beneficiaries. */
export function restorePaymentSelectionFromDrafts(
  drafts: readonly PaymentFormDraft[],
  beneficiaries: readonly Beneficiary[],
  allowMultiple: boolean,
): SelectedPaymentBeneficiary[] {
  const byTin = new Map<string, Beneficiary>();
  for (const person of beneficiaries) if (/^\d{12,13}$/.test(person.tin) && !byTin.has(person.tin))
    byTin.set(person.tin, person);
  const ordered = [...drafts].sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  for (const draft of ordered) {
    const payload = draft.form_payload;
    if (payload.forSelf !== false && payload.forSelf !== true) continue;
    // SELF drafts can include other saved beneficiaries, but the signed-in
    // account itself is not one of their selectable saved-list entries.
    const candidates: unknown[] = payload.forSelf === false ? [payload.tin] : [];
    if (allowMultiple && Array.isArray(payload.additionalTaxpayers)) {
      candidates.push(...payload.additionalTaxpayers.slice(0, 256).map(person =>
        person && typeof person === 'object' ? (person as Record<string,unknown>).tin : null));
    }
    const seen = new Set<string>();
    const matched = candidates
      .filter((tin): tin is string => typeof tin === 'string' && /^\d{12,13}$/.test(tin))
      .filter(tin => !seen.has(tin) && !!seen.add(tin))
      .map(tin => byTin.get(tin))
      .filter((person): person is Beneficiary => !!person)
      .map(person => ({ tin: person.tin, name: beneficiaryNameForPrefill(person.display_name) }));
    if (matched.length) return allowMultiple ? matched : matched.slice(0,1);
  }
  return [];
}
