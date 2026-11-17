/** Exact, fail-closed confirmation for an Auth-owned notification update.
 * Counting returned rows alone does not prove SQL persisted is_read=true.
 * Reject omissions, duplicates, foreign IDs and false or missing read flags.
 */
export function assertAccountNotificationReadRows(expectedIds:readonly string[],rows:unknown):void{
  const invalid=()=>{throw new Error('Review notice read-back not confirmed');};
  if(!Array.isArray(rows)||rows.length!==expectedIds.length)return invalid();
  const expected=new Set(expectedIds);
  if(expected.size!==expectedIds.length)return invalid();
  const seen=new Set<string>();
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row))return invalid();
    const record=row as Record<string,unknown>;
    if(typeof record.id!=='string'||!expected.has(record.id)||seen.has(record.id)||
      record.is_read!==true)return invalid();
    seen.add(record.id);
  }
}
