/**
 * Nonfinancial demo coverage of payer -> transaction -> beneficiary allocations.
 * Sample users are NEVER eTIN/auth identities. This module does not create
 * challans, record Treasury settlements or grant tax credits.
 */
export const demoUserIds = ['user1','user2','user3','user4','user5','user6','user7','user8','user9','user10'] as const;
export type DemoUserId = typeof demoUserIds[number];
export type DemoPaymentCategory = 'TAX_WITH_RETURN'|'ADVANCE_TAX'|'ASSESSED_DEMAND'|'PENALTY'|'SOURCE_TAX_DEPOSIT'|'APPELLATE_TRIBUNAL'|'OTHER_TAX_PAYMENT';
export type DemoTransactionState = 'SIMULATED'|'PENDING'|'FAILED'|'REVERSED';
export interface DemoAllocation {
  id: string;
  beneficiary: DemoUserId;
  category: DemoPaymentCategory;
  assessmentYear: string;
  amountMinor: number; // paisa; never floating-point BDT
}
export interface DemoEvent {
  id: string; occurredAt: string;
  action: 'CREATED'|'REVIEWED'|'SIMULATION_RECORDED'|'PENDING'|'FAILED'|'REVERSED';
  note: string;
}
export interface DemoTransaction {
  id: string; payer: DemoUserId; createdAt: string;
  state: DemoTransactionState; allocations: DemoAllocation[]; events: DemoEvent[];
  simulationOnly: true;
}
const event = (id:string, at:string, action:DemoEvent['action'], note:string):DemoEvent =>
  ({id,occurredAt:at,action,note});
const item = (id:string,beneficiary:DemoUserId,category:DemoPaymentCategory,assessmentYear:string,bdt:number):DemoAllocation =>
  ({id,beneficiary,category,assessmentYear,amountMinor:bdt*100});
const txn = (id:string,payer:DemoUserId,at:string,state:DemoTransactionState,allocations:DemoAllocation[]):DemoTransaction => ({
  id,payer,createdAt:at,state,allocations,simulationOnly:true,
  events: [
    event(id+'-1',at,'CREATED','Synthetic payment intent created; no external submission'),
    event(id+'-2',at,'REVIEWED', 'Allocations and beneficiary identities reviewed as demo inputs'),
    event(id+'-3',at,state==='SIMULATED'?'SIMULATION_RECORDED':state,
      state==='SIMULATED'?'Simulation complete; no money moved':state==='PENDING'?'Simulation awaiting next action':state==='FAILED'?'Simulated attempt failed':'Simulated reversal; not an official refund')
  ]
});
/** Coverage-based scenarios, not a claim that every permutation is enumerated. */
export const demoTransactions: readonly DemoTransaction[] = [
  txn('DEMO-TX-001','user1','2026-10-08T09:15:00Z','SIMULATED',[
    item('DEMO-L-001','user1','ADVANCE_TAX','2026-27',4500)]),
  txn('DEMO-TX-002','user2','2026-10-08T10:35:00Z','SIMULATED',[
    item('DEMO-L-002','user2','TAX_WITH_RETURN','2026-27',8200),
    item('DEMO-L-003','user2','ADVANCE_TAX','2026-27',2500)]),
  txn('DEMO-TX-003','user1','2026-10-09T11:20:00Z','SIMULATED',[
    item('DEMO-L-004','user3','TAX_WITH_RETURN','2026-27',3300)]),
  txn('DEMO-TX-004','user3','2026-10-10T04:25:00Z','SIMULATED',[
    item('DEMO-L-005','user4','ASSESSED_DEMAND','2025-26',6000),
    item('DEMO-L-006','user4','PENALTY','2025-26',400)]),
  txn('DEMO-TX-005','user4','2026-10-10T13:40:00Z','SIMULATED',[
    item('DEMO-L-007','user4','TAX_WITH_RETURN','2026-27',9200),
    item('DEMO-L-008','user1','ADVANCE_TAX','2026-27',1200),
    item('DEMO-L-009','user5','OTHER_TAX_PAYMENT','2025-26',850),
    item('DEMO-L-010','user5','PENALTY','2025-26',150)]),
  txn('DEMO-TX-006','user5','2026-10-11T15:10:00Z','SIMULATED',[
    item('DEMO-L-011','user2','APPELLATE_TRIBUNAL','2025-26',3400),
    item('DEMO-L-012','user3','SOURCE_TAX_DEPOSIT','2026-27',7800)]),
  txn('DEMO-TX-007','user2','2026-10-12T08:05:00Z','FAILED',[
    item('DEMO-L-013','user2','ADVANCE_TAX','2026-27',1000),
    item('DEMO-L-014','user5','ASSESSED_DEMAND','2025-26',500)]),
  txn('DEMO-TX-008','user5','2026-10-12T09:50:00Z','PENDING',[
    item('DEMO-L-015','user1','TAX_WITH_RETURN','2026-27',800)]),
  txn('DEMO-TX-009','user1','2026-10-12T12:25:00Z','REVERSED',[
    item('DEMO-L-016','user4','OTHER_TAX_PAYMENT','2026-27',600)])
];
export function transactionTotalMinor(t:DemoTransaction):number {
  return t.allocations.reduce((sum,a)=>sum+a.amountMinor,0);
}
export function validateDemoTransaction(t:DemoTransaction):string[] {
  const errors:string[]=[];
  if(!t.simulationOnly) errors.push('Non-demo transactions are forbidden');
  if(!demoUserIds.includes(t.payer)) errors.push('Unknown payer');
  if(!t.id || !Number.isFinite(Date.parse(t.createdAt)))errors.push('Missing identity/timestamp');
  if(!t.allocations.length) errors.push('No allocations');
  const ids=new Set<string>();
  for(const line of t.allocations){
    if(ids.has(line.id))errors.push('Duplicate allocation '+line.id);
    ids.add(line.id);
    if(!demoUserIds.includes(line.beneficiary))errors.push('Unknown beneficiary');
    if(!/^\d{4}-\d{2}$/.test(line.assessmentYear))errors.push('Bad demo year');
    if(!Number.isSafeInteger(line.amountMinor)||line.amountMinor<=0)errors.push('Invalid amount');
  }
  if(!t.events.length)errors.push('Missing event timeline');
  for(let i=1;i<t.events.length;i++) if(Date.parse(t.events[i].occurredAt)<Date.parse(t.events[i-1].occurredAt))errors.push('Event out of order');
  return errors;
}
export function getDemoUserTransactions(id:DemoUserId,source:readonly DemoTransaction[]=demoTransactions,view:'payer'|'beneficiary'='beneficiary'){
  return source.filter(tx=>view==='payer'?tx.payer===id:tx.allocations.some(line=>line.beneficiary===id));
}
export function getDemoUserAllocations(id:DemoUserId,source:readonly DemoTransaction[]=demoTransactions){
  return source.flatMap(tx=>tx.allocations.filter(line=>line.beneficiary===id).map(line=>({transaction:tx,allocation:line})));
}
export function appendValidatedDemoTransaction(existing:readonly DemoTransaction[],next:DemoTransaction):DemoTransaction[] {
  const errors=validateDemoTransaction(next);
  if(existing.some(tx=>tx.id===next.id))errors.push('Duplicate transaction id');
  const ids=new Set(existing.flatMap(tx=>tx.allocations.map(line=>line.id)));
  if(next.allocations.some(line=>ids.has(line.id)))errors.push('Allocation replay');
  if(errors.length)throw new Error(errors.join('; '));
  return [...existing,next];
}
export function demoCoverage(source:readonly DemoTransaction[]=demoTransactions){
  return {
    singleSelf: source.some(tx=>tx.allocations.length===1&&tx.allocations[0].beneficiary===tx.payer),
    multiSelf: source.some(tx=>tx.allocations.length>1&&tx.allocations.every(a=>a.beneficiary===tx.payer)),
    singleOther: source.some(tx=>tx.allocations.length===1&&tx.allocations[0].beneficiary!==tx.payer),
    multiOther: source.some(tx=>tx.allocations.length>1&&tx.allocations.every(a=>a.beneficiary!==tx.payer)),
    mixedSelfOther: source.some(tx=>tx.allocations.some(a=>a.beneficiary===tx.payer)&&tx.allocations.some(a=>a.beneficiary!==tx.payer)),
    multiBeneficiary: source.some(tx=>new Set(tx.allocations.map(a=>a.beneficiary)).size>1),
    multiCategory: source.some(tx=>new Set(tx.allocations.map(a=>a.category)).size>1),
    multiYear: source.some(tx=>new Set(tx.allocations.map(a=>a.assessmentYear)).size>1),
  };
}