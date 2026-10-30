import {
  simulationCategories,
  simulationStates,
  simulationUsers,
  type SimulationCategory,
  type SimulationState,
  type SimulationUser,
} from '../contracts/paymentSimulationContract';

export type DashboardParticipantView = 'payer' | 'beneficiary' | 'both';
export type DashboardSimulationAllocation = {
  id: string;
  lineNo: number;
  beneficiary: SimulationUser;
  category: SimulationCategory;
  assessmentYear: string;
  amountMinor: number;
};
export type DashboardSimulationTransaction = {
  id: string;
  transactionId: string;
  payer: SimulationUser;
  state: SimulationState;
  createdAt: string;
  amountMinor: number;
  participantView: DashboardParticipantView;
  allocations: DashboardSimulationAllocation[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUser = (value: unknown): value is SimulationUser =>
  typeof value === 'string' && (simulationUsers as readonly string[]).includes(value);
const isSafeMinor = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function parseTransaction(value: unknown, profileId: SimulationUser, view: 'payer' | 'beneficiary') {
  if (!isObject(value) || value.simulationOnly !== true || !isUser(value.payer) ||
      typeof value.id !== 'string' || !value.id.trim() ||
      typeof value.transactionId !== 'string' || !value.transactionId.trim() ||
      !Number.isFinite(Date.parse(String(value.createdAt))) ||
      typeof value.createdAt !== 'string' ||
      !(simulationStates as readonly unknown[]).includes(value.state) ||
      !isSafeMinor(value.totalMinor) || !Array.isArray(value.allocations)) {
    throw new Error('Unrecognized account payment record');
  }
  if (view === 'payer' && value.payer !== profileId) {
    throw new Error('Payer history contains a different account');
  }
  if (view === 'beneficiary' && !value.allocations.some((allocation: unknown) =>
    isObject(allocation) && allocation.beneficiary === profileId)) {
    throw new Error('Beneficiary history does not contain this account');
  }

  const allocations: DashboardSimulationAllocation[] = value.allocations.map((raw: unknown) => {
    if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id.trim() ||
        typeof raw.lineNo !== 'number' || !Number.isSafeInteger(raw.lineNo) || raw.lineNo < 1 ||
        !isUser(raw.beneficiary) ||
        !(simulationCategories as readonly unknown[]).includes(raw.category) ||
        typeof raw.assessmentYear !== 'string' || !/^20\d{2}-\d{2}$/.test(raw.assessmentYear) ||
        !isSafeMinor(raw.amountMinor) ||
        (view === 'beneficiary' && raw.beneficiary !== profileId)) {
      throw new Error('Unrecognized account payment allocation');
    }
    return {
      id: raw.id,
      lineNo: raw.lineNo,
      beneficiary: raw.beneficiary,
      category: raw.category as SimulationCategory,
      assessmentYear: raw.assessmentYear,
      amountMinor: raw.amountMinor,
    };
  });

  const amountMinor = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > value.totalMinor ||
      (view === 'payer' && amountMinor !== value.totalMinor)) {
    throw new Error('Account payment amount does not reconcile');
  }

  return {
    id: value.id,
    transactionId: value.transactionId,
    payer: value.payer,
    state: value.state as SimulationState,
    createdAt: value.createdAt,
    amountMinor,
    participantView: view,
    allocations,
  } satisfies DashboardSimulationTransaction;
}

/**
 * Builds a private-account dashboard projection from the two owner-scoped RPC views.
 * Beneficiary-only totals use only allocations returned for that account; they never
 * expose a payer's full transaction amount. Scenario records remain simulation-only.
 */
export function projectPrivateDashboardTransactions(
  profileId: SimulationUser,
  payerRows: readonly unknown[],
  beneficiaryRows: readonly unknown[],
): DashboardSimulationTransaction[] {
  const byTransaction = new Map<string, DashboardSimulationTransaction>();
  for (const raw of payerRows) {
    const row = parseTransaction(raw, profileId, 'payer');
    if (byTransaction.has(row.transactionId)) throw new Error('Duplicate payer transaction');
    byTransaction.set(row.transactionId, row);
  }
  for (const raw of beneficiaryRows) {
    const row = parseTransaction(raw, profileId, 'beneficiary');
    const existing = byTransaction.get(row.transactionId);
    if (existing) {
      if (existing.id !== row.id || existing.payer !== row.payer || existing.createdAt !== row.createdAt) {
        throw new Error('Account payment history views disagree');
      }
      existing.participantView = 'both';
    } else {
      byTransaction.set(row.transactionId, row);
    }
  }
  return [...byTransaction.values()].sort((a, b) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.transactionId.localeCompare(b.transactionId));
}

/** Filters an account's private scenario records to one selected AY.
 * A multi-year payment is reduced to only the allocations in that year. */
export function filterPrivateDashboardTransactionsByYear(
  transactions: readonly DashboardSimulationTransaction[],
  assessmentYear: string,
): DashboardSimulationTransaction[] {
  if (!/^20\d{2}-\d{2}$/.test(assessmentYear)) {
    throw new Error('Invalid dashboard assessment year');
  }
  return transactions.flatMap(transaction => {
    const allocations = transaction.allocations.filter(
      allocation => allocation.assessmentYear === assessmentYear,
    );
    if (allocations.length === 0) return [];
    const amountMinor = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error('Dashboard assessment-year amount is invalid');
    }
    return [{ ...transaction, allocations, amountMinor }];
  });
}
