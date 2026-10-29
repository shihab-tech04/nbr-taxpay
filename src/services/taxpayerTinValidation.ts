import { userIdForHostedTin } from './hostedDemoAuthorizations';

/** Format check only; current consent must still be verified separately. */
export function isSupportedBeneficiaryTin(tin: string, allowSyntheticDemoTin: boolean): boolean {
  return /^\d{12}$/.test(tin) || (allowSyntheticDemoTin && /^\d{13}$/.test(tin) && Boolean(userIdForHostedTin(tin)));
}
