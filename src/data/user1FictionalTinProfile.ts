import {DEMO_USERS} from './demoUsers';
import type {TaxpayerTinProfile,TaxpayerTinField} from '../contracts/taxpayerTinProfile';

/**
 * Reference-only User1 profile. Source values are limited to the two uploaded
 * NBR TIN certificate examples and the supplied TIN dashboard screenshots.
 *
 * Individual certificate: nbr_tin_certificate_577935451798.pdf
 * - The provided certificate has the literal placeholder name "TAX NAME".
 * - Keep the pre-existing User1 display name for this fictional UI persona.
 * - This reference is NOT an authorization/ownership binding for its TIN.
 *
 * The existing DEMO_USERS.user1.tin stays unchanged as a private payment
 * journey identifier; do not migrate, reassign, or alias any ledger records.
 */
export const USER1_FICTIONAL_TIN_PROFILE: Readonly<TaxpayerTinProfile> = Object.freeze({
  source: 'REVIEWED_CERTIFICATE',
  sourceUpdatedAt: '2026-06-04T17:06:20+06:00',
  tin: '577935451798',
  taxpayerName: DEMO_USERS.user1.nameEn,
  taxpayerStatus: 'Individual',
  tinType: 'Individual',
  tinSubtype: 'Bangladeshi → Minor/Dependent',
  registeredOn: '19 Jan 2026',
  userType: 'Public',
  localTaxpayer: 'Yes',
  previousTin: 'Not Applicable',
  taxesCircle: 'Circle-245 (Company)',
  taxesZone: 'Taxes Zone-12, Dhaka',
  taxesRange: 'Range-1',
  district: 'Dhaka',
  country: 'Bangladesh',
  registeredAddress: 'Dhaka, 1122, Dhaka, Bangladesh',
  currentAddress: 'Dhaka, 1122, Dhaka, Bangladesh',
  mobileNumber: '+8801857648765',
  emailAddress: 'email@test.com',
  certificateIssuedOn: '19 Jan 2026',
  certificateLastUpdatedOn: '04 Jun 2026, 05:06:20 PM',
  issuingOfficer: 'Deputy Commissioner of Taxes',
  taxOfficeAddress: '3/4 Purana Paltan, Modina Tower (6th Floor), Dhaka',
  taxOfficePhone: '02-9588253',
  lastLoginAt: '11 Nov 2026, 11:23:40 AM',
});

/** Language variants of existing reference fields; no different account data. */
export const USER1_FICTIONAL_TIN_BN: Readonly<Partial<Record<TaxpayerTinField,string>>> = Object.freeze({
  taxpayerName: DEMO_USERS.user1.nameBn,
  taxpayerStatus: 'ব্যক্তি',
  tinType: 'ব্যক্তি',
  tinSubtype: 'বাংলাদেশি → অপ্রাপ্তবয়স্ক/নির্ভরশীল',
  userType: 'সাধারণ ব্যবহারকারী',
  localTaxpayer: 'হ্যাঁ',
  previousTin: 'প্রযোজ্য নয়',
  taxesCircle: 'সার্কেল-২৪৫ (কোম্পানি)',
  taxesZone: 'কর অঞ্চল-১২, ঢাকা',
  taxesRange: 'রেঞ্জ-১',
  district: 'ঢাকা',
  country: 'বাংলাদেশ',
  registeredAddress: 'ঢাকা, ১১২২, ঢাকা, বাংলাদেশ',
  currentAddress: 'ঢাকা, ১১২২, ঢাকা, বাংলাদেশ',
  issuingOfficer: 'উপ-কর কমিশনার',
  taxOfficeAddress: '৩/৪ পুরানা পল্টন, মদিনা টাওয়ার (৬ষ্ঠ তলা), ঢাকা',
  lastLoginAt: '১১ নভেম্বর ২০২৬, সকাল ১১:২৩:৪০',
});

/** Presentation-only; never use supplied certificate data for payment ownership. */
export function user1FictionalTinValue(field:TaxpayerTinField, language:'en'|'bn'):string {
  return language==='bn' && USER1_FICTIONAL_TIN_BN[field]
    ? USER1_FICTIONAL_TIN_BN[field] as string
    : USER1_FICTIONAL_TIN_PROFILE[field] as string;
}
