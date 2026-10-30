import {simulationUsers, type SimulationUser} from '../contracts/paymentSimulationContract';
import {supabase} from './supabaseClient';
import {getBoundSimulationUser, getPrivateSimulationHistory} from './simulatedPaymentsApi';
import {projectPrivateDashboardTransactions, type DashboardSimulationTransaction} from './accountDashboardProjection';

export type PrivateDashboardPaymentActivity =
  | {status:'unlinked';profileId:null;transactions:[]}
  | {status:'linked';profileId:SimulationUser;transactions:DashboardSimulationTransaction[]};

const isUnboundAccount = (error: unknown) =>
  error instanceof Error && error.message.includes('No approved synthetic profile binding');

/** Reads only the current Auth user's approved simulation binding and its payer/beneficiary RPC views. */
export async function loadPrivateDashboardPaymentActivity(ownerUid:string): Promise<PrivateDashboardPaymentActivity> {
  if(!supabase)throw new Error('Authenticated payment service is not configured');
  const assertOwner=async()=>{
    const {data,error}=await supabase!.auth.getUser();
    if(error||data.user?.id!==ownerUid)throw new Error('Account session changed');
  };
  await assertOwner();
  let profileId: SimulationUser;
  try {
    profileId = await getBoundSimulationUser();
  } catch (error) {
    if (isUnboundAccount(error)) {
      await assertOwner();
      return {status:'unlinked',profileId:null,transactions:[]};
    }
    throw error;
  }
  if (!(simulationUsers as readonly string[]).includes(profileId)) {
    throw new Error('The approved account profile is unavailable');
  }
  const [payerRows, beneficiaryRows] = await Promise.all([
    getPrivateSimulationHistory('payer'),
    getPrivateSimulationHistory('beneficiary'),
  ]);
  await assertOwner();
  return {
    status:'linked',
    profileId,
    transactions:projectPrivateDashboardTransactions(profileId,payerRows,beneficiaryRows),
  };
}
