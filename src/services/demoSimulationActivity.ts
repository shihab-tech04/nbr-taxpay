import type {SimulationTransaction,SimulationUser} from '../contracts/paymentSimulationContract';

/** Fictional TaxPay notification projection, not an entitlement or official tax receipt.
 * A beneficiary sees only their own allocated amount, never the entire payer total.
 */
export type DemoSimulationActivity={
  transactionId:string;
  amountMinor:number;
  payer:SimulationUser;
  createdAt:string;
  perspective:'payer'|'beneficiary';
  state:'SIMULATED';
};

function validRecord(record:SimulationTransaction):boolean {
  return record.simulationOnly===true && record.state==='SIMULATED' &&
    typeof record.transactionId==='string' && record.transactionId.length>0 &&
    Number.isSafeInteger(record.totalMinor) && record.totalMinor>0;
}

export function reconcileDemoSimulationActivity(
  actor:SimulationUser,
  payerRows:readonly SimulationTransaction[],
  beneficiaryRows:readonly SimulationTransaction[]
):DemoSimulationActivity[]{
  const found=new Map<string,DemoSimulationActivity>();
  for(const tx of payerRows){
    if(tx.payer!==actor||!validRecord(tx))continue;
    found.set(tx.transactionId,{
      transactionId:tx.transactionId,payer:tx.payer,
      amountMinor:tx.totalMinor,createdAt:tx.createdAt,
      perspective:'payer',state:'SIMULATED',
    });
  }
  for(const tx of beneficiaryRows){
    if(!validRecord(tx)||found.has(tx.transactionId))continue;
    const allocations=tx.allocations.filter(line=>line.beneficiary===actor);
    if(!allocations.length)continue;
    let total=0;
    let valid=true;
    for(const line of allocations){
      if(!Number.isSafeInteger(line.amountMinor)||line.amountMinor<=0||
        !Number.isSafeInteger(total+line.amountMinor)){
        valid=false;break;
      }
      total+=line.amountMinor;
    }
    if(!valid||total<=0||total>tx.totalMinor)continue;
    found.set(tx.transactionId,{
      transactionId:tx.transactionId,payer:tx.payer,
      amountMinor:total,createdAt:tx.createdAt,
      perspective:'beneficiary',state:'SIMULATED',
    });
  }
  return [...found.values()].sort((a,b)=>
    (Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)).slice(0,30);
}
