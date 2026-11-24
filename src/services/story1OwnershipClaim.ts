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
