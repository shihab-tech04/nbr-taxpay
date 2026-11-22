import type { SimulationTransaction, SimulationCategory } from '../contracts/paymentSimulationContract';

/** Display-only mapping. Neither TIN nor account name is proof of ownership. */
export const PAYMENT_CATEGORY_GROUP: Readonly<Record<SimulationCategory, string>> = {
  TAX_WITH_RETURN: 'Tax with Return',
  ADVANCE_TAX: 'Advance Tax',
  ASSESSED_DEMAND: 'Tax against Demand',
  PENALTY: 'Penalty',
  SOURCE_TAX_DEPOSIT: 'Source Tax',
  APPELLATE_TRIBUNAL: 'Appellate Tribunal',
  OTHER_TAX_PAYMENT: 'Others',
};

/** Only call this with a successful owner-bound SQL/RLS or demo-capability history response. */
export function rankFrequentTaxCategoryNames(
  transactions: readonly Pick<SimulationTransaction, 'state' | 'createdAt' | 'allocations'>[],
  limit = 5,
): string[] {
  if (!Number.isInteger(limit) || limit < 1) return [];
  const counts = new Map<string, {count:number; last:number}>();
  let completedPayments = 0;
  for (const transaction of transactions) {
    // Unsuccessful payment attempts must never establish a favorite.
    if (transaction.state !== 'SIMULATED') continue;
    const time = Date.parse(transaction.createdAt);
    if (!Number.isFinite(time)) continue;
    // An entire combined payment counts only once for each unique category.
    const groups = new Set(transaction.allocations.map(item => PAYMENT_CATEGORY_GROUP[item.category]).filter(Boolean));
    if (!groups.size) continue;
    completedPayments += 1;
    for (const name of groups) {
      const previous = counts.get(name);
      counts.set(name,{count:(previous?.count??0)+1,last:Math.max(previous?.last??0,time)});
    }
  }
  // Only accounts with at least two completed payments have frequent categories.
  if (completedPayments < 2) return [];
  return [...counts].sort((a,b) => b[1].count-a[1].count || b[1].last-a[1].last || a[0].localeCompare(b[0]))
    .slice(0,Math.min(5,limit)).map(([name])=>name);
}
