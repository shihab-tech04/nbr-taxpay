/**
 * Shared 12-digit TIN lookup fixtures for the thirty existing TaxPay example
 * profiles. They are lookup aliases, not new Supabase Auth users or issued TINs.
 * Preserve the ten previously approved repeated-digit suggestions.
 */
export const SAMPLE_TIN_SUGGESTIONS: readonly string[] = Object.freeze([
  ...Array.from({length:10},(_,index)=>String(index).repeat(12)),
  ...Array.from({length:20},(_,index)=>'9090000000'+String(index+11)),
]);
export function sampleUserNumberForTin(tin:string):number|null {
  const index=SAMPLE_TIN_SUGGESTIONS.indexOf(tin);
  if(index<0)return null;
  return index<10?(index===0?10:index):index+1;
}
