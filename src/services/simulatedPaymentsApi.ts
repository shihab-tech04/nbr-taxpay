/** Shared public synthetic-only API. The embedded key is PUBLIC anon, never a service key.
 * RLS keeps financial tables isolated; only the purpose-built simulator RPCs are exposed.
 */
const ROOT='https://eyqhoavnitkrajvyqvxn.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cWhvYXZuaXRrcmFqdnlxdnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDYxMTMsImV4cCI6MjEwNzE4MjExM30.cNoto22zmRNIykEM5oItwLL2ykw1LSwI4qqaycw0jI4';
export const simulationUsers=['user1','user2','user3','user4','user5','user6','user7','user8','user9','user10'] as const;
export type SimulationUser=typeof simulationUsers[number];
export const simulationCategories=['TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT'] as const;
export type SimulationCategory=typeof simulationCategories[number];
export type SimulationLine={beneficiary:SimulationUser;category:SimulationCategory;assessmentYear:string;amountMinor:number};
export type SimulationAllocation=SimulationLine&{id:string;lineNo:number};
export type SimulationEvent={id:number;action:string;note:string;occurredAt:string};
export type SimulationTransaction={id:string;transactionId:string;payer:SimulationUser;state:'SIMULATED'|'PENDING'|'FAILED'|'REVERSED';createdAt:string;simulationOnly:true;totalMinor:number;allocations:SimulationAllocation[];events:SimulationEvent[]};
export type SimulationNotice={id:number;userId:SimulationUser;transactionId:string;messageCode:string;createdAt:string;isRead:boolean};
export type SimSubmission={transactionId:string;reference:string;totalMinor:number;replayed:boolean};
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
