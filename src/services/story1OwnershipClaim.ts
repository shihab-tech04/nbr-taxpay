/** Retry only the idempotent ownership RPC, never the payment submission.
 * The original actor must still be current, including the exact session token.
 * No token, owner identifier or receipt content is persisted or emitted. */
export type ClaimActor = {userId:string;accessToken:string};
export type ClaimAttempt = 'acknowledged'|'retryable'|'denied';
export async function retryStory1OwnershipClaim(
  actor:ClaimActor|null,
  currentActor:()=>Promise<ClaimActor|null>,
  claim:(actor:ClaimActor)=>Promise<ClaimAttempt>,
  pause:(ms:number)=>Promise<void> = ms=>new Promise(resolve=>setTimeout(resolve,ms)),
):Promise<'acknowledged'|'pending'|'skipped'> {
  if(!actor)return 'skipped';
  for(let attempt=0;attempt<3;attempt++){
    try{
      const current=await currentActor();
      if(!current||current.userId!==actor.userId||current.accessToken!==actor.accessToken)return 'skipped';
    }catch{return 'pending';}
    let result:ClaimAttempt;
    try{result=await claim(actor);}catch{result='retryable';}
    if(result==='acknowledged')return result;
    if(result==='denied')return 'pending';
    if(attempt<2)await pause(100*(attempt+1));
  }
  return 'pending';
}

/** Every page uses the captured bearer and rejects changed sessions before and
 * after I/O. Never accept data fetched through a mutable client auth token. */
export async function readStory1OwnedPaymentPage(actor:ClaimActor,
  currentActor:()=>Promise<ClaimActor|null>,endpoint:string,publishableKey:string,
  page:number,fetcher:typeof fetch=fetch):Promise<unknown>{
  const assertCurrent=async()=>{
    const current=await currentActor();
    if(!current||current.userId!==actor.userId||current.accessToken!==actor.accessToken)
      throw Error('Account identity changed');
  };
  await assertCurrent();
  const response=await fetcher(endpoint.replace(/\/$/,'')+'/rest/v1/rpc/taxpay_my_story1_payments',{
    method:'POST',cache:'no-store',headers:{apikey:publishableKey,
      Authorization:'Bearer '+actor.accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({p_page:page,p_per_page:100})
  });
  if(!response.ok)throw Error('Unable to verify account-owned payment history');
  const data:unknown=await response.json();
  await assertCurrent();
  return data;
}
