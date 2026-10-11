export type ReviewOnlySourceChange = Readonly<{
  sourceHeadId: number;
  sourceDocumentSha256: string;
  reason: string;
  proposedPatch: Readonly<Record<string, unknown>>;
}>;
export type SourceProposalValidation = Readonly<{
  acceptedForReview: boolean;
  executable: false;
  error: string | null;
}>;
export function validateSourceChangeProposal(
  input: ReviewOnlySourceChange, knownSourceHeadIds: ReadonlySet<number>
): SourceProposalValidation {
  const failed=(error:string):SourceProposalValidation=>({acceptedForReview:false,executable:false,error});
  if (!Number.isSafeInteger(input.sourceHeadId) || !knownSourceHeadIds.has(input.sourceHeadId))
    return failed('Source head does not exist in the controlled candidate catalogue.');
  if (!/^[0-9a-f]{64}$/.test(input.sourceDocumentSha256))
    return failed('Source document SHA-256 is required in exact lowercase hexadecimal format.');
  if (input.reason.trim().length < 10 || input.reason.length > 1000)
    return failed('Review reason must be 10–1000 characters.');
  if (!input.proposedPatch || Array.isArray(input.proposedPatch) ||
      typeof input.proposedPatch !== 'object' ||
      Object.keys(input.proposedPatch).length === 0 ||
      JSON.stringify(input.proposedPatch).length > 16384) {
    return failed('A bounded, nonempty proposed change document is required.');
  }
  return {acceptedForReview:true,executable:false,error:null};
}
