/** Proposed head applicability decision engine.
 * All production v11 candidates remain legally UNVERIFIED and non-executable.
 * Synthetic test fixtures are NOT legal source data.
 */
export type TaxpayerClass = 'INDIVIDUAL' | 'COMPANY' | 'WITHHOLDING_AGENT' | 'OTHER';
export type PaymentEvent = 'RETURN' | 'ADVANCE' | 'ASSESSMENT' | 'WITHHOLDING_DEPOSIT' | 'OTHER';
export type ApplicabilityFacts = {
  readonly headId: number;
  readonly taxpayerClass: TaxpayerClass;
  readonly paymentEvent: PaymentEvent;
  readonly eventDate: string;
  readonly incomeYear: string;
  readonly assessmentYear: string;
};
export type SourcedApplicability = {
  readonly headId: number;
  readonly sourceId: string;
  readonly sourceVerified: boolean;
  readonly legalApproved: boolean;
  readonly version: number;
  readonly taxpayerClasses: readonly TaxpayerClass[];
  readonly paymentEvents: readonly PaymentEvent[];
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly incomeYear: string;
  readonly assessmentYear: string;
};
export type ApplicabilityResult = Readonly<{
  decision: 'INVALID_FACTS' | 'NO_VERIFIED_SOURCE' | 'NOT_APPLICABLE' | 'CONFLICT' | 'PROVISIONALLY_APPLICABLE';
  reason: string;
  financialExecutionAllowed: false;
  sourceId: string | null;
  sourceVersion: number | null;
}>;

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}
function validPeriod(value: string): boolean {
  const m = /^(20\d\d)-(\d\d)$/.exec(value);
  return !!m && Number(m[2]) === ((Number(m[1]) + 1) % 100);
}
function result(decision: ApplicabilityResult['decision'], reason: string,
                evidence: SourcedApplicability | null = null): ApplicabilityResult {
  return Object.freeze({
    decision, reason,
    financialExecutionAllowed: false as const,
    sourceId: evidence?.sourceId ?? null,
    sourceVersion: evidence?.version ?? null
  });
}

export function evaluateCandidateHeadApplicability(
  facts: ApplicabilityFacts, candidateIds: ReadonlySet<number>,
  evidence: readonly SourcedApplicability[]
): ApplicabilityResult {
  const classes: readonly string[] = ['INDIVIDUAL', 'COMPANY', 'WITHHOLDING_AGENT', 'OTHER'];
  const events: readonly string[] = ['RETURN', 'ADVANCE', 'ASSESSMENT', 'WITHHOLDING_DEPOSIT', 'OTHER'];
  if (!Number.isSafeInteger(facts.headId) || facts.headId <= 0 ||
      !classes.includes(facts.taxpayerClass) || !events.includes(facts.paymentEvent) ||
      !validIsoDate(facts.eventDate) ||
      !validPeriod(facts.incomeYear) || !validPeriod(facts.assessmentYear)) {
    return result('INVALID_FACTS', 'Invalid or missing taxpayer, period or payment event facts');
  }
  if (!candidateIds.has(facts.headId)) {
    return result('NO_VERIFIED_SOURCE', 'Unknown source head identifier');
  }
  const legal = evidence.filter(x => x.headId === facts.headId &&
    x.sourceVerified && x.legalApproved && x.sourceId.trim().length > 0 &&
    Number.isSafeInteger(x.version) && x.version > 0 &&
    validIsoDate(x.effectiveFrom) && validIsoDate(x.effectiveTo) &&
    x.effectiveFrom <= x.effectiveTo && validPeriod(x.incomeYear) &&
    validPeriod(x.assessmentYear));
  if (legal.length === 0) {
    return result('NO_VERIFIED_SOURCE', 'No approved legal applicability evidence for this source head');
  }
  const matching = legal.filter(x => x.taxpayerClasses.includes(facts.taxpayerClass) &&
    x.paymentEvents.includes(facts.paymentEvent) &&
    facts.eventDate >= x.effectiveFrom && facts.eventDate <= x.effectiveTo &&
    facts.incomeYear === x.incomeYear && facts.assessmentYear === x.assessmentYear);
  if (matching.length === 0) {
    return result('NOT_APPLICABLE', 'No confirmed rule for this exact taxpayer, event and period');
  }
  if (matching.length !== 1) {
    return result('CONFLICT', 'Multiple overlapping approved records require legal reconciliation');
  }
  return result('PROVISIONALLY_APPLICABLE',
    'A single synthetic applicability record matches; payment remains blocked until all official integration gates pass',
    matching[0]);
}

/** Only unverified v11 source candidate data exists in TaxPay production.
 * Never upgrade the candidates to executable payment heads from this function.
 */
export function evaluateProductionHeadApplicability(
  facts: ApplicabilityFacts, knownHeadIds: ReadonlySet<number>
): ApplicabilityResult {
  return evaluateCandidateHeadApplicability(facts, knownHeadIds, []);
}
