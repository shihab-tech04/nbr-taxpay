import { DEMO_USERS } from '../data/demoUsers';
import { sampleUserNumberForTin } from '../data/sampleTinSuggestions';

/** Display-only, fictional TaxPay TIN lookup data. Never use this as proof of identity or authorization. */
export function lookupSampleTaxpayer(tin: string): { tin: string; nameEn: string; nameBn: string } | null {
  const match = /^([0-9])\1{11}$/.exec(tin);
  if (match) {
    const id = match[1] === '0' ? 10 : Number(match[1]);
    return { tin, nameEn: `User ${id}`, nameBn: `ইউজার ${id}` };
  }
  const sampleUserNumber=sampleUserNumberForTin(tin);
  if(sampleUserNumber!==null) {
    const profile=DEMO_USERS[`user${sampleUserNumber}` as keyof typeof DEMO_USERS];
    return {tin,nameEn:profile.nameEn,nameBn:profile.nameBn};
  }
  // Existing signed-in simulation accounts use 13-digit fixture identifiers.
  const account = Object.values(DEMO_USERS).find(user => user.tin === tin);
  return account ? { tin, nameEn: account.nameEn, nameBn: account.nameBn } : null;
}
