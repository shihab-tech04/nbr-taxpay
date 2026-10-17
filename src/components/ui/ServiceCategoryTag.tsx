import type { ReactNode } from 'react';
import type { PaymentCategory } from '../../types/tax';

export type ServiceCategoryCode = PaymentCategory | 'TRAVEL_TAX';

/** Category identity only. Financial and reconciliation statuses remain separate. */
export function ServiceCategoryTag({ code, children }: { code: ServiceCategoryCode; children: ReactNode }) {
  return <span className="taxpay-service-category" data-payment-service={code}>{children}</span>;
}
