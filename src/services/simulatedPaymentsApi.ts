/** Shared public synthetic-only API. The embedded key is PUBLIC anon, never a service key.
 * RLS keeps financial tables isolated; only the purpose-built simulator RPCs are exposed.
 */
const ROOT='https://eyqhoavnitkrajvyqvxn.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cWhvYXZuaXRrcmFqdnlxdnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDYxMTMsImV4cCI6MjEwNzE4MjExM30.cNoto22zmRNIykEM5oItwLL2ykw1LSwI4qqaycw0jI4';
export {simulationUsers,simulationCategories,TAXPAY_SIMULATION_CONTRACT_VERSION,simulationCategoryLabels,paymentJourneyStages,paymentStageLabels} from '../contracts/paymentSimulationContract';
export type {SimulationUser,SimulationCategory,SimulationLine,SimulationAllocation,SimulationEvent,SimulationTransaction,SimulationNotice,SimSubmission} from '../contracts/paymentSimulationContract';
import type {SimulationUser,SimulationLine,SimulationTransaction,SimulationNotice,SimSubmission} from '../contracts/paymentSimulationContract';
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const response=await fetch(ROOT+'/rest/v1/rpc/'+name,{
   method:'POST',cache:'no-store',
   headers:{apikey:ANON,Authorization:'Bearer '+ANON,'Content-Type':'application/json'},
   body:JSON.stringify(args)
 });
 if(!response.ok){let message='Simulation API returned HTTP '+response.status;
   try{const data=await response.json();if(typeof data.message==='string')message=data.message;}catch{/* keep status */}
   throw new Error(message);
 }
 return response.json() as Promise<T>;
}
export const loadSimulationHistory=(user:SimulationUser|null,view:'beneficiary'|'payer'|'all'='beneficiary')=>
 rpc<SimulationTransaction[]>('sim_payment_history',{p_user_id:user,p_view:view});
export const loadSimulationNotices=(user:SimulationUser)=>
 rpc<SimulationNotice[]>('sim_payment_notices',{p_user_id:user});
export const submitSimulatedPayment=(payer:SimulationUser,lines:SimulationLine[],key:string)=>
 rpc<SimSubmission>('sim_submit_payment',{p_payer_id:payer,p_lines:lines,p_idempotency_key:key});
/** Story1 rows are shared with Office SQL, unlike the authenticated simulator ledger. */
export const getDemoStoryPaymentHistory=async (user:SimulationUser,view:'beneficiary'|'payer')=>{
 // Preserve the existing compact first-page API and all approved UI consumers.
 // A legacy 200-row reply was previously mistaken for COMPLETE history.
 const first=await rpc<SimulationTransaction[]>('demo_story1_demo_history',{p_actor:user,p_view:view});
 if(!Array.isArray(first)||first.length>200)throw Error('Invalid demo history page');
 let rows=[...first];
 if(first.length===200){
   // The legacy first page is not guaranteed to select same-timestamp ties
   // consistently at its cutoff. Restart from the beginning using the stable
   // (created_at, id) cursor rather than potentially skipping older payments.
   rows=[];
   const seen=new Set<string>();
   let beforeAt:string|null=null,beforeId:string|null=null;
   let finished=false;
   for(let page=0;page<10000;page++){
     const next:SimulationTransaction[]=await rpc<SimulationTransaction[]>('demo_story1_demo_history_page',{
       p_actor:user,p_view:view,p_before_created_at:beforeAt,
       p_before_id:beforeId,p_page_size:100
     });
     if(!Array.isArray(next)||next.length>100)throw Error('Invalid demo history cursor response');
     for(const tx of next){
       if(!tx.transactionId||seen.has(tx.transactionId))throw Error('Duplicate demo payment record');
       seen.add(tx.transactionId);rows.push(tx);
     }
     if(next.length<100){finished=true;break;}
     const last:SimulationTransaction=next[next.length-1];
     beforeAt=last.createdAt;beforeId=last.transactionId;
   }
   if(!finished)throw Error('Demo payment history exceeds safe retrieval limit');
 } else if(new Set(rows.map(tx=>tx.transactionId)).size!==rows.length){
   throw Error('Duplicate demo payment record');
 }
 return rows.map(tx=>({...tx,allocations:tx.allocations.map((a,index)=>({
   ...a,id:a.id??`${tx.transactionId}-${index+1}`,lineNo:a.lineNo??index+1
 }))}));
};
/** Decimal money input is converted to integer paisa without floating-point rounding. */
export function parseSimulatedAmount(value:string):number {
 const s=value.trim();
 if(!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(s))throw Error('Use a positive amount with up to two decimals');
 const [whole,fract='']=s.split('.');
 const minor=Number(whole)*100+Number(fract.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor<=0)throw Error('Enter a positive amount');
 return minor;
}
export const formatSimulatedAmount=(minor:number)=>'৳'+new Intl.NumberFormat('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);

import { supabase } from './supabaseClient';

/** Real authenticated profile RPCs are separate from fictional PUBLIC sandbox APIs.
 * Never use the public anon token for an authenticated owner's notifications/transactions.
 */
async function signedRpc<T>(functionName:string,args:Record<string,unknown>={}):Promise<T>{
 if(!supabase)throw Error('Authenticated payment service is not configured');
 const {data:identity,error:identityError}=await supabase.auth.getUser();
 if(identityError||!identity.user)throw Error('Sign in to use your protected account');
 const {data,error}=await supabase.rpc(functionName,args);
 if(error)throw Error(error.message);
 const {data:verified,error:recheck}=await supabase.auth.getUser();
 if(recheck||verified.user?.id!==identity.user.id)throw Error('Account changed during payment operation');
 return data as T;
}
export const getBoundSimulationUser=()=>signedRpc<SimulationUser>('sim_my_taxpayer_profile');
export const getPrivateSimulationHistory=(view:'payer'|'beneficiary')=>
 signedRpc<SimulationTransaction[]>('sim_my_payment_history',{p_view:view});
export const getPrivateSimulationNotices=()=>
 signedRpc<SimulationNotice[]>('sim_my_payment_notices');
export const submitPrivateSimulationPayment=(lines:SimulationLine[],key:string)=>
 signedRpc<SimSubmission>('sim_submit_my_payment',{p_lines:lines,p_idempotency_key:key});
export const setPrivateSimulationNoticeRead=(id:number,read:boolean)=>
 signedRpc<{id:number;isRead:boolean;userId:SimulationUser}>('sim_set_my_notice_read',{p_notice_id:id,p_is_read:read});
