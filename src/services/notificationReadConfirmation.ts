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

/** Ignore out-of-order polling responses and invalidated owner views.
 * An older network result must never restore an unread notice after a newer
 * read-state fetch or acknowledgement has completed.
 */
export function createAccountNotificationRefreshGate(){
  let generation=0;
  return {
    next:()=>++generation,
    isLatest:(requestId:number)=>requestId===generation,
    invalidate:()=>{generation++;},
  };
}

/** Fetch the whole owner-filtered notification register, without the silent
 * PostgREST first-page limit. Concurrent inserts that duplicate an offset
 * page fail closed; the user can retry rather than trust incomplete history.
 */
export async function collectAccountNotificationPages<T extends {id:string}>(
  readPage:(from:number,to:number)=>Promise<T[]>,
  pageSize=100,maxPages=50,
):Promise<T[]>{
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||
     !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50)
    throw Error('Invalid account notification pagination.');
  const all:T[]=[];
  const seen=new Set<string>();
  for(let page=0;page<maxPages;page++){
    const offset=page*pageSize;
    const rows=await readPage(offset,offset+pageSize-1);
    if(!Array.isArray(rows)||rows.length>pageSize)
      throw Error('Invalid account notification page.');
    for(const row of rows){
      if(!row||typeof row.id!=='string'||!row.id||seen.has(row.id))
        throw Error('Account notifications changed while loading. Retry.');
      seen.add(row.id);
      all.push(row);
    }
    if(rows.length<pageSize)return all;
  }
  throw Error('Account notifications exceed the safe retrieval limit. Retry.');
}
