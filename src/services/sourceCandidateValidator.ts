import { V11_SOURCE_HEADS, type V11Head } from '../data/v11SourceHeads';

export type CandidateRow = {
  source_head_id: number;
  source_map: string;
  verification_status: string;
  executable: boolean;
  raw_original_record: unknown;
};

const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
};

export function verifyCandidateRows(rows: unknown): readonly V11Head[] {
  if (!Array.isArray(rows) || rows.length !== 170) {
    throw new Error('Candidate catalogue integrity failure: expected exactly 170 records');
  }
  const normalized = rows as CandidateRow[];
  for (let i = 0; i < V11_SOURCE_HEADS.length; i++) {
    const record = normalized[i];
    const expected = V11_SOURCE_HEADS[i];
    if (!record || record.source_head_id !== expected.id ||
        record.verification_status !== 'UNVERIFIED' ||
        record.executable !== false || record.source_map !== expected.map ||
        JSON.stringify(sortJson(record.raw_original_record)) !== JSON.stringify(sortJson(expected))) {
      throw new Error('Candidate catalogue integrity failure at source head ' + expected.id);
    }
  }
  // Return the byte-controlled immutable source records. Verified identity is
  // NOT approval of law, effective date, ACS accounting codes or payment status.
  return V11_SOURCE_HEADS;
}
