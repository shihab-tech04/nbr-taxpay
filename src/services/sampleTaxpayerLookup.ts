import { DEMO_USERS } from '../data/demoUsers';

/** Display-only, fictional TaxPay TIN lookup data. Never use this as proof of identity or authorization. */
export function lookupSampleTaxpayer(tin: string): { tin: string; nameEn: string; nameBn: string } | null {
  const match = /^([0-9])\1{11}$/.exec(tin);
  if (match) {
    const id = match[1] === '0' ? 10 : Number(match[1]);
    return { tin, nameEn: `User ${id}`, nameBn: `ইউজার ${id}` };
  }
  // Existing signed-in simulation accounts use 13-digit fixture identifiers.
  const account = Object.values(DEMO_USERS).find(user => user.tin === tin);
  return account ? { tin, nameEn: account.nameEn, nameBn: account.nameBn } : null;
}
