export {simulationUsers,simulationCategories,TAXPAY_SIMULATION_CONTRACT_VERSION,simulationCategoryLabels,paymentJourneyStages,paymentStageLabels} from '../contracts/paymentSimulationContract';
export type {SimulationUser,SimulationCategory,SimulationLine,SimulationAllocation,SimulationEvent,SimulationTransaction,SimulationNotice,SimSubmission} from '../contracts/paymentSimulationContract';
import type {SimulationUser,SimulationLine,SimulationTransaction,SimulationNotice,SimSubmission} from '../contracts/paymentSimulationContract';
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

/** Bound synthetic-account RPCs require a verified Auth identity and server-side profile assignment.
 * Anonymous/public RPCs for payment histories, notices, and submission are intentionally absent.
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
