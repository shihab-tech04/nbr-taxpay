import type { UserRole } from '../types/tax';

/** Public, non-credentialed demonstration scenarios. Never use for Auth, RLS or tax-credit ownership. */
export const DEMO_USER_IDS = ['user1','user2','user3','user4','user5','user6','user7','user8','user9','user10','user11','user12','user13','user14','user15','user16','user17','user18','user19','user20','user21','user22','user23','user24','user25','user26','user27','user28', 'user29','user30','user31','user32','user33','user34','user35','user36','user37','user38','user39','user40','user41','user42','user43','user44','user45','user46','user47','user48','user49','user50','user51','user52','user53','user54','user55'] as const;
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
 user31: {id:'user31',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 31',nameBn:'করদাতা অ্যাকাউন্ট 31',tin:'9000000000031',taxCircle:'circle-31',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user32: {id:'user32',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 32',nameBn:'করদাতা অ্যাকাউন্ট 32',tin:'9000000000032',taxCircle:'circle-32',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user33: {id:'user33',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 33',nameBn:'করদাতা অ্যাকাউন্ট 33',tin:'9000000000033',taxCircle:'circle-33',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user34: {id:'user34',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 34',nameBn:'করদাতা অ্যাকাউন্ট 34',tin:'9000000000034',taxCircle:'circle-34',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user35: {id:'user35',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 35',nameBn:'করদাতা অ্যাকাউন্ট 35',tin:'9000000000035',taxCircle:'circle-35',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user36: {id:'user36',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 36',nameBn:'করদাতা অ্যাকাউন্ট 36',tin:'9000000000036',taxCircle:'circle-36',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user37: {id:'user37',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 37',nameBn:'করদাতা অ্যাকাউন্ট 37',tin:'9000000000037',taxCircle:'circle-37',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user38: {id:'user38',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 38',nameBn:'করদাতা অ্যাকাউন্ট 38',tin:'9000000000038',taxCircle:'circle-38',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user39: {id:'user39',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 39',nameBn:'করদাতা অ্যাকাউন্ট 39',tin:'9000000000039',taxCircle:'circle-39',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user40: {id:'user40',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 40',nameBn:'করদাতা অ্যাকাউন্ট 40',tin:'9000000000040',taxCircle:'circle-40',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user41: {id:'user41',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 41',nameBn:'করদাতা অ্যাকাউন্ট 41',tin:'9000000000041',taxCircle:'circle-41',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user42: {id:'user42',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 42',nameBn:'করদাতা অ্যাকাউন্ট 42',tin:'9000000000042',taxCircle:'circle-42',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user43: {id:'user43',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 43',nameBn:'করদাতা অ্যাকাউন্ট 43',tin:'9000000000043',taxCircle:'circle-43',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user44: {id:'user44',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 44',nameBn:'করদাতা অ্যাকাউন্ট 44',tin:'9000000000044',taxCircle:'circle-44',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user45: {id:'user45',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 45',nameBn:'করদাতা অ্যাকাউন্ট 45',tin:'9000000000045',taxCircle:'circle-45',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user46: {id:'user46',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 46',nameBn:'করদাতা অ্যাকাউন্ট 46',tin:'9000000000046',taxCircle:'circle-46',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user47: {id:'user47',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 47',nameBn:'করদাতা অ্যাকাউন্ট 47',tin:'9000000000047',taxCircle:'circle-47',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user48: {id:'user48',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 48',nameBn:'করদাতা অ্যাকাউন্ট 48',tin:'9000000000048',taxCircle:'circle-48',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user49: {id:'user49',role:'WITHHOLDING_AGENT',nameEn:'Taxpayer Account 49',nameBn:'করদাতা অ্যাকাউন্ট 49',tin:'9000000000049',taxCircle:'circle-49',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user50: {id:'user50',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 50',nameBn:'করদাতা অ্যাকাউন্ট 50',tin:'9000000000050',taxCircle:'circle-50',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user51: {id:'user51',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 51',nameBn:'করদাতা অ্যাকাউন্ট 51',tin:'9000000000051',taxCircle:'circle-51',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user52: {id:'user52',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 52',nameBn:'করদাতা অ্যাকাউন্ট 52',tin:'9000000000052',taxCircle:'circle-52',focusEn:'Mixed-year payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user53: {id:'user53',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 53',nameBn:'করদাতা অ্যাকাউন্ট 53',tin:'9000000000053',taxCircle:'circle-53',focusEn:'Travel tax combinations',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user54: {id:'user54',role:'TAXPAYER_INDIVIDUAL',nameEn:'Taxpayer Account 54',nameBn:'করদাতা অ্যাকাউন্ট 54',tin:'9000000000054',taxCircle:'circle-54',focusEn:'Multiple-beneficiary payments',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
 user55: {id:'user55',role:'TAXPAYER_CORPORATE',nameEn:'Taxpayer Account 55',nameBn:'করদাতা অ্যাকাউন্ট 55',tin:'9000000000055',taxCircle:'circle-55',focusEn:'Income tax heads',focusBn:'বিভিন্ন কর পরিশোধের বিবরণ'},
};
export function getDemoUser(input: unknown): DemoUser | null {
 if(typeof input!=='string'||!/^user(?:[1-9]|[1-4][0-9]|5[0-5])$/.test(input))return null;
 return DEMO_USERS[input as DemoUserId];
}
