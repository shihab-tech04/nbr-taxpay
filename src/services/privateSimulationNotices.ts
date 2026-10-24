import type {SimulationNotice,SimulationTransaction,SimulationUser} from '../contracts/paymentSimulationContract';
import {reconcileDemoSimulationActivity} from './demoSimulationActivity';

/** Owner-scoped projection of SQL review events to verified simulation amounts.
 * Never use public demo RPCs or a full payer total for a beneficiary's notice.
 * An unverifiable amount is null, never inferred or presented as settled money.
 */
export type VerifiedPrivateSimulationNotice=SimulationNotice & {
  amountMinor:number|null;
  perspective:'payer'|'beneficiary'|null;
};

export function reconcilePrivateSimulationNotices(
  actor:SimulationUser,
  notices:readonly SimulationNotice[],
  payerRows:readonly SimulationTransaction[],
  beneficiaryRows:readonly SimulationTransaction[],
):VerifiedPrivateSimulationNotice[]{
  const verified=new Map(reconcileDemoSimulationActivity(actor,payerRows,beneficiaryRows,Number.MAX_SAFE_INTEGER)
    .map(record=>[record.transactionId,record] as const));
  return notices.map(notice=>{
    // A broken owner-scoped RPC must fail closed rather than render another person's activity.
    if(notice.userId!==actor)throw Error('Private notification owner mismatch');
    const activity=verified.get(notice.transactionId);
    return {...notice,amountMinor:activity?.amountMinor??null,perspective:activity?.perspective??null};
  });
}
