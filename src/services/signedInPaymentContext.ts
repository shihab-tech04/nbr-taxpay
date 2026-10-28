import { getDemoUser, type DemoUserId } from '../data/demoUsers';
import type { HostedAuthorization } from './hostedDemoAuthorizations';
import type { DemoSqlServiceRecord, DemoServiceCode } from './demoSqlProfiles';

/** Presentation helper only. The payment API must independently enforce ownership. */
export function activeAuthorizedTaxpayers(records: readonly HostedAuthorization[], payer: DemoUserId, now = Date.now()) {
  const seen = new Set<DemoUserId>();
  return records.filter(record => record.payerId === payer && record.status === 'ACTIVE' &&
      typeof record.activeUntil === 'number' && record.activeUntil > now)
    .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0))
    .flatMap(record => {
      if (seen.has(record.taxpayerId)) return [];
      seen.add(record.taxpayerId);
      const user = getDemoUser(record.taxpayerId);
      return user ? [{ authorizationId: record.id, userId: user.id, tin: user.tin,
        nameEn: user.nameEn, nameBn: user.nameBn, activeUntil: record.activeUntil! }] : [];
    });
}

export type PaymentSuggestion = {
  serviceCode: DemoServiceCode;
  state: DemoSqlServiceRecord['state'];
  assessmentYear: string | null;
  /** Never treat this historical simulation as a tax demand. */
  requiresReview: boolean;
};

/** Recommendations drawn only from this taxpayer's explicitly scoped sample records.
 * No amount/credit/liability is inferred, and pending records cannot initiate duplicates. */
export function accountPaymentSuggestions(records: readonly DemoSqlServiceRecord[], mode: 'TAX_WITH_RETURN' | 'OTHER_TAX_PAYMENT'): PaymentSuggestion[] {
  const accepted = mode === 'TAX_WITH_RETURN'
    ? new Set<DemoServiceCode>(['TAX_WITH_RETURN'])
    : new Set<DemoServiceCode>(['ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT']);
  const seen = new Set<DemoServiceCode>();
  return [...records].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .filter(record => {
      if (record.simulationOnly !== true || !accepted.has(record.serviceCode) || seen.has(record.serviceCode)) return false;
      seen.add(record.serviceCode);
      return true;
    }).slice(0, 4).map(record => ({
      serviceCode: record.serviceCode, state: record.state, assessmentYear: record.assessmentYear,
      requiresReview: record.state !== 'SIMULATED',
    }));
}
