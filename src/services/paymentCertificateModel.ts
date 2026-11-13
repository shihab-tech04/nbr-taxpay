import type { ChallanReceipt, PaymentCategory } from '../types/tax';
import { CATEGORY_LABELS, MASTER_PAYMENT_HEADS } from '../data/paymentHeads';
import { validCertificateTransactionId } from './transactionId';

export interface PaymentCertificateLine {
  recipientName: string;
  recipientTin?: string;
  descriptionEn: string;
  descriptionBn: string;
  economicCode?: string;
  assessmentYear?: string;
  amountMinor: number;
  passportMasked?: string;
  nationality?: string;
  country?: string;
  age?: number;
}

export interface PaymentCertificateModel {
  contractVersion: 1;
  paymentTransactionId: string;
  certificateReference: string;
  paymentReference: string;
  paymentDate: string;
  payerName: string;
  payerTin?: string;
  serviceEn: string;
  serviceBn: string;
  assessmentYears: string[];
  totalMinor: number;
  lines: PaymentCertificateLine[];
  travel?: NonNullable<ChallanReceipt['travelDetails']>;
}

const validTin = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d{12,13}$/.test(value.trim());

const toMinor = (amount: number): number | null => {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
};

const validYear = (value: string) => {
  const match = /^(20\d{2})-(\d{2})$/.exec(value.trim());
  return !!match && Number(match[2]) === (Number(match[1]) + 1) % 100;
};
const validTravelDate = (value: string) => {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

function paymentReference(receipt: ChallanReceipt, parentId: string): string {
  const candidate = receipt.challanNo.trim();
  // Synthetic/internal references must never leak from the test or preview
  // environment into the user-facing certificate.
  if (!candidate || /\b(?:SIM|SIMULATED|DEMO|QA|TEST)\b/i.test(candidate)) return parentId;
  return candidate;
}

/** Build a certificate only from a completed parent and reconciled saved lines. */
export function buildPaymentCertificateModel(receipt: ChallanReceipt): PaymentCertificateModel | null {
  const parentId = receipt.paymentTransactionId?.trim() ?? '';
  if (!validCertificateTransactionId(parentId) || !receipt.completedAt) return null;

  const totalMinor = toMinor(receipt.totalAmount);
  const paymentDate = receipt.completedAt || receipt.createdAt;
  const parsedDate = new Date(paymentDate);
  const payerName = receipt.payerName.trim();
  if (totalMinor === null || totalMinor <= 0 || Number.isNaN(parsedDate.getTime()) ||
      !payerName || payerName === '—') return null;

  const payerTin = validTin(receipt.payerTin) ? receipt.payerTin.trim() : undefined;
  const categoryLabels = CATEGORY_LABELS[receipt.paymentCategory as PaymentCategory];
  const serviceEn = categoryLabels?.en ?? receipt.paymentCategory;
  const serviceBn = categoryLabels?.bn ?? serviceEn;
  let lines: PaymentCertificateLine[] = [];
  let travel: PaymentCertificateModel['travel'];

  if (receipt.paymentCategory === 'TRAVEL_TAX') {
    const details = receipt.travelDetails;
    if (!details || !details.departurePort.trim() || !details.destination.trim() ||
        !validTravelDate(details.travelDate) ||
        !Array.isArray(details.passengers) || details.passengers.length < 1) return null;
    lines = details.passengers.map((passenger): PaymentCertificateLine | null => {
      const amountMinor = toMinor(passenger.amount);
      if (amountMinor === null || !passenger.name.trim() || !passenger.passportMasked.trim()) return null;
      return {
        recipientName: passenger.name.trim(),
        descriptionEn: 'Travel Tax',
        descriptionBn: 'ভ্রমণ কর',
        economicCode: details.economicCode,
        amountMinor,
        passportMasked: passenger.passportMasked,
        nationality: passenger.nationality === 'BD' ? 'Bangladeshi' : 'Foreign',
        country: passenger.country?.trim() || undefined,
        age: passenger.age,
      };
    }).filter((line): line is PaymentCertificateLine => line !== null);
    if (lines.length !== details.passengers.length) return null;
    const lineTotal = lines.reduce((sum, line) => sum + line.amountMinor, 0);
    if (!Number.isSafeInteger(lineTotal) || lineTotal !== totalMinor) return null;
    travel = details;
  } else if (receipt.allocationItems) {
    if (receipt.allocationItems.length < 1) return null;
    lines = receipt.allocationItems.map((allocation): PaymentCertificateLine | null => {
      const recipientTin = validTin(allocation.taxpayerTin) ? allocation.taxpayerTin.trim() : undefined;
      const assessmentYear = allocation.assessmentYear.trim() || receipt.assessmentYear.trim();
      const descriptionEn = allocation.paymentServiceEn.trim();
      const descriptionBn = allocation.paymentServiceBn.trim() || descriptionEn;
      const amountMinor = allocation.amountMinor;
      if (!recipientTin || !validYear(assessmentYear) || !descriptionEn ||
          !Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
      return {
        recipientName: allocation.taxpayerName.trim() || 'TIN ' + recipientTin,
        recipientTin,
        descriptionEn,
        descriptionBn,
        economicCode: allocation.economicCode?.trim() || undefined,
        assessmentYear,
        amountMinor,
      };
    }).filter((line): line is PaymentCertificateLine => line !== null);
    if (lines.length !== receipt.allocationItems.length) return null;
  } else {
    const recipientTin = validTin(receipt.taxpayerTin) ? receipt.taxpayerTin.trim()
      : !receipt.isRepresentativePayment && validTin(receipt.payerTin) ? receipt.payerTin.trim() : undefined;
    if (!recipientTin || !validYear(receipt.assessmentYear)) return null;
    lines = receipt.items.map((item): PaymentCertificateLine | null => {
      const amountMinor = toMinor(item.totalAmount);
      if (amountMinor === null || !item.headNameEn.trim()) return null;
      return {
        recipientName: receipt.taxpayerName?.trim() || (!receipt.isRepresentativePayment ? payerName : 'TIN ' + recipientTin),
        recipientTin,
        descriptionEn: item.headNameEn.trim(),
        descriptionBn: MASTER_PAYMENT_HEADS.find(head =>
          head.id === item.headId && head.nameEn === item.headNameEn)?.nameBn || item.headNameEn.trim(),
        economicCode: item.economicCode.trim() || undefined,
        assessmentYear: receipt.assessmentYear,
        amountMinor,
      };
    }).filter((line): line is PaymentCertificateLine => line !== null);
    if (!lines.length || lines.length !== receipt.items.length) return null;
  }

  const lineTotal = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  if (!Number.isSafeInteger(lineTotal) || lineTotal !== totalMinor) return null;
  const assessmentYears = [...new Set(lines.map(line => line.assessmentYear).filter((year): year is string => !!year))];
  return {
    contractVersion: 1,
    paymentTransactionId: parentId,
    certificateReference: 'SK-PC-' + parentId,
    paymentReference: paymentReference(receipt, parentId),
    paymentDate,
    payerName,
    payerTin,
    serviceEn,
    serviceBn,
    assessmentYears,
    totalMinor,
    lines,
    travel,
  };
}
