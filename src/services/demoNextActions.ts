import type { DemoSqlServiceRecord, DemoServiceCode } from './demoSqlProfiles';
import type { Language } from '../types/tax';

/**
 * Helpful navigation based on SQL-backed fictional service records.
 * Never treats a simulated payment as tax credit, liability, or a demand to pay.
 */
export type DemoNextAction = {
  id: string;
  kind: 'review' | 'explore';
  serviceCode: DemoServiceCode | null;
  reason: 'failed' | 'reversed' | 'review' | 'pending' | 'previous' | 'first';
};

const reviewPriority = {
  FAILED: 0,
  REVERSED: 1,
  REVIEW_REQUIRED: 2,
  PENDING: 3,
  SIMULATED: 4,
} as const;

export function buildDemoNextActions(records: readonly DemoSqlServiceRecord[]): DemoNextAction[] {
  const ordered = [...records].sort((a, b) =>
    reviewPriority[a.state] - reviewPriority[b.state] ||
    Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
    a.recordId.localeCompare(b.recordId));
  const actions: DemoNextAction[] = [];
  const seen = new Set<DemoServiceCode>();

  for (const record of ordered) {
    if (record.state === 'SIMULATED' || seen.has(record.serviceCode)) continue;
    seen.add(record.serviceCode);
    const reason = record.state === 'FAILED' ? 'failed'
      : record.state === 'REVERSED' ? 'reversed'
      : record.state === 'PENDING' ? 'pending' : 'review';
    actions.push({ id: record.recordId, kind: 'review', serviceCode: record.serviceCode, reason });
    if (actions.length === 2) break;
  }

  const previous = [...records].filter(r => r.state === 'SIMULATED')
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
      a.recordId.localeCompare(b.recordId)).find(r => !seen.has(r.serviceCode));
  if (previous) actions.push({
    id: `previous-${previous.serviceCode}`, kind: 'explore',
    serviceCode: previous.serviceCode, reason: 'previous'
  });
  if (!actions.length) actions.push({
    id: 'explore-services', kind: 'explore', serviceCode: null, reason: 'first'
  });
  return actions;
}

const descriptions: Record<DemoNextAction['reason'], { en: string; bn: string }> = {
  failed: { en: 'A payment request failed. Check its record before deciding whether another payment is necessary.', bn: 'একটি পেমেন্ট অনুরোধ ব্যর্থ হয়েছে। নতুন পরিশোধের সিদ্ধান্তের আগে রেকর্ডটি দেখুন।' },
  reversed: { en: 'A payment record was reversed. Review its timeline; credit and outstanding amounts are not verified.', bn: 'একটি পেমেন্ট রেকর্ড প্রত্যাবর্তিত হয়েছে। সময়রেখা দেখুন; ক্রেডিট ও বকেয়া যাচাই হয়নি।' },
  review: { en: 'A service record needs review. Check its details and status first.', bn: 'একটি সেবার রেকর্ড পর্যালোচনা প্রয়োজন। আগে বিস্তারিত ও অবস্থা দেখুন।' },
  pending: { en: 'A payment request is pending. Check the existing record before paying again.', bn: 'একটি পেমেন্ট অনুরোধ অপেক্ষমাণ। পুনরায় পরিশোধের আগে রেকর্ডটি যাচাই করুন।' },
  previous: { en: 'This service has an earlier record. Review available options if you need a new payment.', bn: 'এই সেবার আগের রেকর্ড আছে। নতুন পরিশোধ প্রয়োজন হলে বিকল্পগুলো দেখুন।' },
  first: { en: 'There is no stored service activity. Explore payment types and choose only what applies.', bn: 'সেবার কোনো রেকর্ড নেই। পরিশোধের ধরন দেখুন এবং প্রযোজ্য হলে বেছে নিন।' }
};
/** Review stays within the exact SQL record view; it must not navigate to an
 * unrelated activity feed or an unregistered router destination. */
export function nextActionDestination(action: DemoNextAction): 'record' | 'services' {
  return action.kind === 'review' ? 'record' : 'services';
}

export function nextActionDescription(action: DemoNextAction, language: Language): string {
  return descriptions[action.reason][language];
}
