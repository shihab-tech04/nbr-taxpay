import type { UserRole } from '../types/tax';

/** Public, non-credentialed demonstration scenarios. Never use for Auth, RLS or tax-credit ownership. */
export type DemoUserId = 'user1'|'user2'|'user3'|'user4'|'user5'|'user6'|'user7'|'user8'|'user9'|'user10';
export type DemoUser = { id: DemoUserId; role: UserRole; nameEn: string; nameBn: string; focusEn: string; focusBn: string };
export const DEMO_USERS: Record<DemoUserId, DemoUser> = {
 user1: {id:'user1',role:'TAXPAYER_INDIVIDUAL',nameEn:'Individual taxpayer',nameBn:'ব্যক্তি করদাতা',focusEn:'Personal income-tax payments',focusBn:'ব্যক্তিগত আয়কর পরিশোধ'},
 user2: {id:'user2',role:'TAXPAYER_CORPORATE',nameEn:'Company taxpayer',nameBn:'কোম্পানি করদাতা',focusEn:'Corporate payment records',focusBn:'কোম্পানির পেমেন্ট রেকর্ড'},
 user3: {id:'user3',role:'WITHHOLDING_AGENT',nameEn:'Withholding agent',nameBn:'উৎসে কর কর্তনকারী',focusEn:'Source-tax deposit workflow',focusBn:'উৎসে কর জমার প্রক্রিয়া'},
 user4: {id:'user4',role:'TAXPAYER_INDIVIDUAL',nameEn:'Self-employed taxpayer',nameBn:'স্বনিযুক্ত করদাতা',focusEn:'Business and professional payment records',focusBn:'ব্যবসা ও পেশার পেমেন্ট রেকর্ড'},
 user5: {id:'user5',role:'TAXPAYER_INDIVIDUAL',nameEn:'Multi-year taxpayer',nameBn:'একাধিক করবর্ষের করদাতা',focusEn:'Assessment-year tracking',focusBn:'করবর্ষভিত্তিক তথ্য অনুসরণ'},
 user6: {id:'user6',role:'TAXPAYER_INDIVIDUAL',nameEn:'Advance-tax taxpayer',nameBn:'অগ্রিম কর পরিশোধকারী',focusEn:'Advance tax and instalment review',focusBn:'অগ্রিম কর ও কিস্তি পর্যালোচনা'},
 user7: {id:'user7',role:'TAXPAYER_INDIVIDUAL',nameEn:'New taxpayer 07',nameBn:'নতুন করদাতা 07',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},,
 user8: {id:'user8',role:'TAXPAYER_INDIVIDUAL',nameEn:'New taxpayer 08',nameBn:'নতুন করদাতা 08',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},,
 user9: {id:'user9',role:'TAXPAYER_INDIVIDUAL',nameEn:'New taxpayer 09',nameBn:'নতুন করদাতা 09',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},,
 user10: {id:'user10',role:'TAXPAYER_INDIVIDUAL',nameEn:'New taxpayer 10',nameBn:'নতুন করদাতা 10',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},
};
export function getDemoUser(input: unknown): DemoUser | null {
 if(typeof input!=='string'||!/^user(?:10|[1-9])$/.test(input))return null;
 return DEMO_USERS[input as DemoUserId];
}
