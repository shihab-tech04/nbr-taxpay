import type { UserRole } from '../types/tax';

/** Public, non-credentialed demonstration scenarios. Never use for Auth, RLS or tax-credit ownership. */
export type DemoUserId = 'user1'|'user2'|'user3'|'user4'|'user5'|'user6'|'user7'|'user8'|'user9'|'user10';
export type DemoUser = { id: DemoUserId; role: UserRole; nameEn: string; nameBn: string; tin: string; taxCircle: string; focusEn: string; focusBn: string };
// Controlled fictional identifiers for the ten signed-in UI scenarios. These
// 13-digit samples were specified for the simulation and are NOT issued e-TINs.
export const DEMO_USERS: Record<DemoUserId, DemoUser> = {
 user1: {id:'user1',role:'TAXPAYER_INDIVIDUAL',nameEn:'Md. Arif Rahman',nameBn:'মো. আরিফ রহমান',tin:'1'.repeat(13),taxCircle:'circle-1',focusEn:'Personal income-tax payments',focusBn:'ব্যক্তিগত আয়কর পরিশোধ'},
 user2: {id:'user2',role:'TAXPAYER_CORPORATE',nameEn:'Meghna Trading Ltd.',nameBn:'মেঘনা ট্রেডিং লিমিটেড',tin:'2'.repeat(13),taxCircle:'circle-2',focusEn:'Corporate payment records',focusBn:'কোম্পানির পেমেন্ট রেকর্ড'},
 user3: {id:'user3',role:'WITHHOLDING_AGENT',nameEn:'Rupali Textiles Ltd.',nameBn:'রূপালী টেক্সটাইলস লিমিটেড',tin:'3'.repeat(13),taxCircle:'circle-3',focusEn:'Source-tax deposit workflow',focusBn:'উৎসে কর জমার প্রক্রিয়া'},
 user4: {id:'user4',role:'TAXPAYER_INDIVIDUAL',nameEn:'Nusrat Jahan',nameBn:'নুসরাত জাহান',tin:'4'.repeat(13),taxCircle:'circle-4',focusEn:'Business and professional payment records',focusBn:'ব্যবসা ও পেশার পেমেন্ট রেকর্ড'},
 user5: {id:'user5',role:'TAXPAYER_INDIVIDUAL',nameEn:'Mahmud Hasan',nameBn:'মাহমুদ হাসান',tin:'5'.repeat(13),taxCircle:'circle-5',focusEn:'Assessment-year tracking',focusBn:'করবর্ষভিত্তিক তথ্য অনুসরণ'},
 user6: {id:'user6',role:'TAXPAYER_INDIVIDUAL',nameEn:'Farzana Akter',nameBn:'ফারজানা আক্তার',tin:'6'.repeat(13),taxCircle:'circle-6',focusEn:'Advance tax and instalment review',focusBn:'অগ্রিম কর ও কিস্তি পর্যালোচনা'},
 user7: {id:'user7',role:'TAXPAYER_INDIVIDUAL',nameEn:'Sadia Islam',nameBn:'সাদিয়া ইসলাম',tin:'7'.repeat(13),taxCircle:'circle-7',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},
 user8: {id:'user8',role:'TAXPAYER_INDIVIDUAL',nameEn:'Tanvir Ahmed',nameBn:'তানভীর আহমেদ',tin:'8'.repeat(13),taxCircle:'circle-8',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},
 user9: {id:'user9',role:'TAXPAYER_INDIVIDUAL',nameEn:'Imran Hossain',nameBn:'ইমরান হোসেন',tin:'9'.repeat(13),taxCircle:'circle-9',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},
 user10: {id:'user10',role:'TAXPAYER_INDIVIDUAL',nameEn:'Shaila Parvin',nameBn:'শায়লা পারভীন',tin:'1010101010101',taxCircle:'circle-10',focusEn:'First-time payment',focusBn:'প্রথমবার পেমেন্ট'},
};
export function getDemoUser(input: unknown): DemoUser | null {
 if(typeof input!=='string'||!/^user(?:10|[1-9])$/.test(input))return null;
 return DEMO_USERS[input as DemoUserId];
}
