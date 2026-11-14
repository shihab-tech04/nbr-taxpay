import type { Language } from '../types/tax';

/** Read-only public wording for recorded payment and credit states.
 * Never turn an unknown internal code into a user-visible assertion.
 */
const labels: Record<string, { en: string; bn: string }> = {
  INITIATED: { en: 'Initiated', bn: 'শুরু হয়েছে' },
  GATEWAY_PENDING: { en: 'Payment pending', bn: 'পেমেন্ট অপেক্ষমাণ' },
  GATEWAY_SUCCESS: { en: 'Gateway completed', bn: 'গেটওয়ে সম্পন্ন' },
  TREASURY_SCROLLED: { en: 'Treasury recorded', bn: 'ট্রেজারিতে নথিভুক্ত' },
  FAILED: { en: 'Failed', bn: 'ব্যর্থ' },
  EXPIRED: { en: 'Expired', bn: 'মেয়াদ শেষ' },
  REVERSED: { en: 'Reversed', bn: 'প্রত্যাবর্তিত' },
  NOT_APPLICABLE: { en: 'Not applicable', bn: 'প্রযোজ্য নয়' },
  PENDING_RECONCILIATION: { en: 'Reconciliation pending', bn: 'সমন্বয় অপেক্ষমাণ' },
  CREDITED_TO_LEDGER: { en: 'Credit not verified', bn: 'ক্রেডিট যাচাই হয়নি' },
  CLAIMED_IN_RETURN: { en: 'Claim not verified', bn: 'দাবি যাচাই হয়নি' },
  DISPUTED: { en: 'Disputed', bn: 'বিরোধপূর্ণ' },
};

export function paymentStatusLabel(
  status: string,
  language: Language,
  isSimulatedDemo = false,
): string {
  // A local preview record cannot establish real gateway or Treasury settlement.
  if (isSimulatedDemo && status === 'GATEWAY_SUCCESS') {
    return language === 'bn' ? 'পেমেন্ট রেকর্ড সংরক্ষিত' : 'Payment record saved';
  }
  if (isSimulatedDemo && status === 'TREASURY_SCROLLED') {
    return language === 'bn' ? 'ট্রেজারির অবস্থা যাচাই হয়নি' : 'Treasury status not verified';
  }
  const label = Object.hasOwn(labels, status) ? labels[status] : undefined;
  return label?.[language] ??
    (language === 'bn' ? 'অবস্থা যাচাই করা যায়নি' : 'Status unavailable');
}
