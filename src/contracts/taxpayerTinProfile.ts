/**
 * Complete read-only field contract, based on the e-TIN certificate and NBR
 * TIN dashboard reference. No browser-supplied TIN grants account ownership.
 * Only an authorized, independently verified server source may populate it.
 */
export type TaxpayerTinProfile = {
  source: 'NBR_TIN' | 'REVIEWED_CERTIFICATE' | 'SYNTHETIC';
  sourceUpdatedAt: string;
  tin: string;
  taxpayerName: string | null;
  taxpayerStatus: string | null;
  tinType: string | null;
  tinSubtype: string | null;
  registeredOn: string | null;
  userType: string | null;
  localTaxpayer: string | null;
  previousTin: string | null;
  taxesCircle: string | null;
  taxesZone: string | null;
  taxesRange: string | null;
  district: string | null;
  country: string | null;
  registeredAddress: string | null;
  currentAddress: string | null;
  mobileNumber: string | null;
  emailAddress: string | null;
  certificateIssuedOn: string | null;
  certificateLastUpdatedOn: string | null;
  issuingOfficer: string | null;
  taxOfficeAddress: string | null;
  taxOfficePhone: string | null;
  lastLoginAt: string | null;
};

export type TaxpayerTinField = Exclude<keyof TaxpayerTinProfile, 'source' | 'sourceUpdatedAt'>;

/** A 13-digit fictional scenario identifier is never accepted as an issued e-TIN. */
export function isWellFormedTinProfile(value: TaxpayerTinProfile | null | undefined): value is TaxpayerTinProfile {
  return Boolean(value &&
    ((value.source === 'SYNTHETIC' && /^[0-9]{13}$/.test(value.tin)) ||
     ((value.source === 'NBR_TIN' || value.source === 'REVIEWED_CERTIFICATE') &&
      /^[0-9]{12}$/.test(value.tin))) &&
    typeof value.sourceUpdatedAt === 'string' &&
    Number.isFinite(Date.parse(value.sourceUpdatedAt)));
}
