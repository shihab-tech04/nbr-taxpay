import type { UserRole } from '../types/tax';

/** Public, non-credentialed demonstration scenarios. Never use for Auth, RLS or tax-credit ownership. */
export const DEMO_USER_IDS = ['user1','user2','user3','user4','user5','user6','user7','user8','user9','user10','user11','user12','user13','user14','user15','user16','user17','user18','user19','user20','user21','user22','user23','user24','user25','user26','user27','user28','user29','user30'] as const;
export type DemoUserId = typeof DEMO_USER_IDS[number];
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
 user11: {id:'user11',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 11',nameBn:'করদাতা অ্যাকাউন্ট 11',tin:'9000000000011',taxCircle:'circle-11',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user12: {id:'user12',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 12',nameBn:'করদাতা অ্যাকাউন্ট 12',tin:'9000000000012',taxCircle:'circle-12',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user13: {id:'user13',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 13',nameBn:'করদাতা অ্যাকাউন্ট 13',tin:'9000000000013',taxCircle:'circle-13',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user14: {id:'user14',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 14',nameBn:'করদাতা অ্যাকাউন্ট 14',tin:'9000000000014',taxCircle:'circle-14',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user15: {id:'user15',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 15',nameBn:'করদাতা অ্যাকাউন্ট 15',tin:'9000000000015',taxCircle:'circle-15',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user16: {id:'user16',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 16',nameBn:'করদাতা অ্যাকাউন্ট 16',tin:'9000000000016',taxCircle:'circle-16',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user17: {id:'user17',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 17',nameBn:'করদাতা অ্যাকাউন্ট 17',tin:'9000000000017',taxCircle:'circle-17',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user18: {id:'user18',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 18',nameBn:'করদাতা অ্যাকাউন্ট 18',tin:'9000000000018',taxCircle:'circle-18',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user19: {id:'user19',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 19',nameBn:'করদাতা অ্যাকাউন্ট 19',tin:'9000000000019',taxCircle:'circle-19',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user20: {id:'user20',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 20',nameBn:'করদাতা অ্যাকাউন্ট 20',tin:'9000000000020',taxCircle:'circle-20',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user21: {id:'user21',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 21',nameBn:'করদাতা অ্যাকাউন্ট 21',tin:'9000000000021',taxCircle:'circle-21',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user22: {id:'user22',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 22',nameBn:'করদাতা অ্যাকাউন্ট 22',tin:'9000000000022',taxCircle:'circle-22',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user23: {id:'user23',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 23',nameBn:'করদাতা অ্যাকাউন্ট 23',tin:'9000000000023',taxCircle:'circle-23',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user24: {id:'user24',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 24',nameBn:'করদাতা অ্যাকাউন্ট 24',tin:'9000000000024',taxCircle:'circle-24',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user25: {id:'user25',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 25',nameBn:'করদাতা অ্যাকাউন্ট 25',tin:'9000000000025',taxCircle:'circle-25',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user26: {id:'user26',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 26',nameBn:'করদাতা অ্যাকাউন্ট 26',tin:'9000000000026',taxCircle:'circle-26',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user27: {id:'user27',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 27',nameBn:'করদাতা অ্যাকাউন্ট 27',tin:'9000000000027',taxCircle:'circle-27',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user28: {id:'user28',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 28',nameBn:'করদাতা অ্যাকাউন্ট 28',tin:'9000000000028',taxCircle:'circle-28',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user29: {id:'user29',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 29',nameBn:'করদাতা অ্যাকাউন্ট 29',tin:'9000000000029',taxCircle:'circle-29',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user30: {id:'user30',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 30',nameBn:'করদাতা অ্যাকাউন্ট 30',tin:'9000000000030',taxCircle:'circle-30',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
};
export function getDemoUser(input: unknown): DemoUser | null {
 if(typeof input!=='string'||!/^user(?:[1-9]|[12][0-9]|30)$/.test(input))return null;
 return DEMO_USERS[input as DemoUserId];
}
