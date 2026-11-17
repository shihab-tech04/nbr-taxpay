import { DEMO_USERS, type DemoUserId } from '../data/demoUsers';
import { sampleUserNumberForTin } from '../data/sampleTinSuggestions';

export type IncomeTaxEntityType = 'NON_COMPANY' | 'COMPANY';

/**
 * Fictional catalogue metadata only. Never classify a real taxpayer from the
 * digits of their TIN, and never use this value for Auth, RLS or tax credit.
 * The two explicit demonstration assignments are distinct from legacy demo roles.
 */
export function demoIncomeTaxTypeForTin(tin: string): IncomeTaxEntityType | null {
  const number = sampleUserNumberForTin(tin);
  const sample = number !== null
    ? DEMO_USERS[`user${number}` as DemoUserId]
    : Object.values(DEMO_USERS).find(user => user.tin === tin);
  if (!sample) return null;
  if (sample.id === 'user2') return 'NON_COMPANY';
  if (sample.id === 'user3') return 'COMPANY';
  if (sample.role === 'TAXPAYER_CORPORATE') return 'COMPANY';
  if (sample.role === 'TAXPAYER_INDIVIDUAL') return 'NON_COMPANY';
  return null; // A withholding-agent role does not establish legal entity type.
}

export function incomeTaxEntityTypeLabel(type: IncomeTaxEntityType, language: 'en'|'bn'): string {
  return type === 'COMPANY'
    ? (language === 'bn' ? 'কোম্পানি' : 'Company')
    : (language === 'bn' ? 'কোম্পানি ব্যতীত ব্যক্তি' : 'Person other than company');
}
