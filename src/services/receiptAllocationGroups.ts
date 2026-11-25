import type { ReceiptAllocationItem } from '../types/tax';

export type ReceiptTaxpayerGroup = {
  key: string;
  taxpayerName: string;
  taxpayerTin?: string;
  items: ReceiptAllocationItem[];
  totalMinor: number;
};

/** Presentation only: group receipt allocations by exact TIN. Never group
 * anonymous historical allocations by display name or rewrite payment data. */
export function groupReceiptAllocations(items: readonly ReceiptAllocationItem[]): ReceiptTaxpayerGroup[] {
  const groups: ReceiptTaxpayerGroup[] = [];
  const byTin = new Map<string, ReceiptTaxpayerGroup>();
  for (const [index, item] of items.entries()) {
    const tin = item.taxpayerTin?.trim();
    const key = tin ? `tin:${tin}` : `unknown:${index}`;
    let group = tin ? byTin.get(key) : undefined;
    if (!group) {
      group = { key, taxpayerName: item.taxpayerName, ...(tin ? { taxpayerTin: tin } : {}), items: [], totalMinor: 0 };
      groups.push(group);
      if (tin) byTin.set(key, group);
    }
    group.items.push(item);
    group.totalMinor += item.amountMinor;
  }
  return groups;
}
