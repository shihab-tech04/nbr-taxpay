/** Client-side input hygiene only. Supabase Auth verifies codes server-side. */
export function normalizeEmailOneTimeCode(input:string):string {
  return input.replace(/[^0-9]/g,'').slice(0,6);
}
export function isCompleteEmailOneTimeCode(input:string):boolean {
  return /^[0-9]{6}$/.test(input);
}
