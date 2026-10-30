import { getDemoUser, type DemoUserId } from '../data/demoUsers';
import type { HostedAuthorization } from './hostedDemoAuthorizations';
import type { DemoSqlServiceRecord, DemoServiceCode } from './demoSqlProfiles';

/** Presentation helper only. The payment API must independently enforce ownership. */
export function activeAuthorizedTaxpayers(records: readonly HostedAuthorization[], payer: DemoUserId, now = Date.now()) {
  const seen = new Set<DemoUserId>();
  return records.filter(record => record.payerId === payer && record.status === 'ACTIVE' &&
      (record.activeUntil === null || record.activeUntil > now))
    .sort((a, b) => (b.confirmedAt ?? 0) - (a.confirmedAt ?? 0))
    .flatMap(record => {
      if (seen.has(record.taxpayerId)) return [];
      seen.add(record.taxpayerId);
      const user = getDemoUser(record.taxpayerId);
      return user ? [{ authorizationId: record.id, userId: user.id, tin: user.tin,
        nameEn: user.nameEn, nameBn: user.nameBn, activeUntil: record.activeUntil }] : [];
    });
}

export type PaymentSuggestionMode = 'TAX_WITH_RETURN' | 'OTHER_TAX_PAYMENT' | 'SOURCE_TAX_DEPOSIT';
export type PaymentSuggestion = {
  taxpayerId: DemoUserId;
  recordId: string;
  serviceCode: DemoServiceCode;
  state: DemoSqlServiceRecord['state'];
  assessmentYear: string | null;
  /** A prior recorded scenario amount is never a current demand or payment prefill. */
  requiresReview: boolean;
};

/** Suggestions use only records scoped to the selected synthetic taxpayer.
 * They can prefill category/year, never a statutory head, NBR reference, or due amount. */
export function accountPaymentSuggestions(
  records: readonly DemoSqlServiceRecord[],
  mode: PaymentSuggestionMode,
  taxpayerId: DemoUserId,
): PaymentSuggestion[] {
  const accepted:Record<PaymentSuggestionMode,ReadonlySet<DemoServiceCode>>={
    TAX_WITH_RETURN:new Set<DemoServiceCode>(['TAX_WITH_RETURN']),
    OTHER_TAX_PAYMENT:new Set<DemoServiceCode>(['ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT']),
    SOURCE_TAX_DEPOSIT:new Set<DemoServiceCode>(['SOURCE_TAX_DEPOSIT']),
  };
  const seen = new Set<DemoServiceCode>();
  return [...records].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .filter(record => {
      if (record.userId !== taxpayerId || record.simulationOnly !== true ||
          !accepted[mode].has(record.serviceCode) || seen.has(record.serviceCode)) return false;
      seen.add(record.serviceCode);
      return true;
    }).slice(0, 4).map(record => ({
      taxpayerId,recordId:record.recordId,serviceCode: record.serviceCode, state: record.state, assessmentYear: record.assessmentYear,
      requiresReview: record.state !== 'SIMULATED',
    }));
}
