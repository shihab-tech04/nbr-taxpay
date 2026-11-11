import {DEMO_USERS} from './demoUsers';
import type {TaxpayerTinProfile,TaxpayerTinField} from '../contracts/taxpayerTinProfile';

/**
 * Fictional persona only. No values were copied from a real taxpayer's uploaded
 * e-TIN, official NBR endpoints, Auth metadata, or financial ledger.
 * Retain the established 13-digit synthetic payment reference: changing it
 * would detach previously recorded sample payments and receipts.
 */
export const USER1_FICTIONAL_TIN_PROFILE: Readonly<TaxpayerTinProfile> = Object.freeze({
  source: 'SYNTHETIC',
  sourceUpdatedAt: '2026-11-01T09:00:00+06:00',
  tin: DEMO_USERS.user1.tin,
  taxpayerName: DEMO_USERS.user1.nameEn,
  taxpayerStatus: 'Individual',
  tinType: 'Individual',
  tinSubtype: 'Bangladeshi · Resident individual',
  registeredOn: '19 Jan 2026',
  userType: 'Public',
  localTaxpayer: 'Yes',
  previousTin: 'None',
  taxesCircle: 'Circle-1 (Individual)',
  taxesZone: 'Taxes Zone-1, Dhaka',
  taxesRange: 'Range-1',
  district: 'Dhaka',
  country: 'Bangladesh',
  registeredAddress: 'House 12, Road 8, Dhanmondi, Dhaka 1205, Bangladesh',
  currentAddress: 'Flat 4B, Road 9, Mirpur, Dhaka 1216, Bangladesh',
  mobileNumber: '01700000001',
  emailAddress: 'arif.rahman@example.com',
  certificateIssuedOn: '19 Jan 2026',
  certificateLastUpdatedOn: '01 Mar 2026',
  issuingOfficer: 'Deputy Commissioner of Taxes (sample office)',
  taxOfficeAddress: 'Tax Circle-1, Taxes Zone-1, Dhaka (illustrative)',
  taxOfficePhone: '02-00000000',
  lastLoginAt: '01 Nov 2026, 09:00 (sample record)',
});

/** Translated display values for the same immutable fictional persona. */
export const USER1_FICTIONAL_TIN_BN: Readonly<Partial<Record<TaxpayerTinField,string>>> = Object.freeze({
  taxpayerName: DEMO_USERS.user1.nameBn,
  taxpayerStatus: 'ব্যক্তি',
  tinType: 'ব্যক্তি',
  tinSubtype: 'বাংলাদেশি · আবাসিক ব্যক্তি',
  userType: 'সাধারণ ব্যবহারকারী',
  localTaxpayer: 'হ্যাঁ',
  previousTin: 'নেই',
  taxesCircle: 'সার্কেল-১ (ব্যক্তি)',
  taxesZone: 'কর অঞ্চল-১, ঢাকা',
  taxesRange: 'রেঞ্জ-১',
  district: 'ঢাকা',
  country: 'বাংলাদেশ',
  registeredAddress: 'বাড়ি ১২, রোড ৮, ধানমন্ডি, ঢাকা ১২০৫, বাংলাদেশ',
  currentAddress: 'ফ্ল্যাট ৪বি, রোড ৯, মিরপুর, ঢাকা ১২১৬, বাংলাদেশ',
  issuingOfficer: 'উপ-কর কমিশনার (নমুনা অফিস)',
  taxOfficeAddress: 'কর সার্কেল-১, কর অঞ্চল-১, ঢাকা (নমুনা)',
  lastLoginAt: '১ নভেম্বর ২০২৬, সকাল ৯:০০ (নমুনা তথ্য)',
});

/** Presentation-only fixture. Never use as a verified TIN lookup or ownership decision. */
export function user1FictionalTinValue(field:TaxpayerTinField, language:'en'|'bn'):string {
  return language==='bn' && USER1_FICTIONAL_TIN_BN[field]
    ? USER1_FICTIONAL_TIN_BN[field] as string
    : USER1_FICTIONAL_TIN_PROFILE[field] as string;
}
