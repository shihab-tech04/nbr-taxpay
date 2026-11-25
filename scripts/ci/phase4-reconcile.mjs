/** Read-only Phase 4 payment parity gate; no credentials, DB writes or inferred tax credit. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reconcileThreeWay} from './phase4-threeway.mjs';
import {pathToFileURL} from 'node:url';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const txt=x=>typeof x==='string'&&x.trim()?x.trim():null;
const money=x=>/^(0|[1-9]\d*)$/.test(String(x))?String(x):null;
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':obj(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const hash=x=>createHash('sha256').update(String(x)).digest('hex');
const ref=id=>hash(id).slice(0,12); // Not a taxpayer identifier.
function projection(row){
  if(!obj(row)||!txt(row.id)||!obj(row.data)||!obj(row.data.details)||!txt(row.status)||!txt(row.service_code)||!money(row.amount_minor))throw Error('INVALID_PARENT');
  const d=row.data.details,r=obj(d.receiptSnapshot)?d.receiptSnapshot:{};
  const allocations=(Array.isArray(d.allocations)?d.allocations:[]).map(a=>({
    id:txt(a?.allocationId),payer:txt(a?.payerTin),recipient:txt(a?.taxpayerTin),
    head:a?.headId??null,year:txt(a?.assessmentYear),dhara:txt(a?.dhara)??txt(a?.section),
    source:txt(a?.source),amount:money(a?.amountMinor)
  }));
  return {payment:row.id,service:row.service_code,origin:txt(row.data.origin),
    // Application origin (TAXPAY_UI/QA_BROWSER) is NOT a verified provider/source.
    source:txt(d.paymentSource)??txt(d.source)??txt(row.data.paymentSource)??txt(row.data.source),
    amount:money(row.amount_minor),status:row.status,
    payer:{id:txt(d.payerId),tin:txt(d.payerTin)??txt(r.payerTin),mode:txt(d.payerMode)},
    recipient:txt(d.taxpayerTin)??txt(r.taxpayerTin),year:txt(d.assessmentYear)??txt(r.assessmentYear),
    dhara:txt(d.dhara)??txt(d.section)??txt(r.dhara),
    challan:txt(r.challanNo)??txt(d.challanNo),
    references:{receipt:txt(d.receiptReference),payment:txt(r.paymentTransactionId),
      taxEvent:txt(r.taxEventId),gateway:txt(r.gatewayTransactionId),idempotency:txt(row.data.idempotencyKey)},
    allocations,lines:Array.isArray(d.lines)?d.lines:[],raw:hash(canonical(row.data))};
}
function mapRows(rows,system,issues){
  if(!Array.isArray(rows))throw Error('INVALID_'+system.toUpperCase()+'_EXPORT');
  const found=new Map();
  for(const row of rows){
    const id=txt(row?.id);
    if(!id||found.has(id)){issues.push({system,record:id?ref(id):null,field:'payment',reason:id?'DUPLICATE':'MISSING_ID'});continue;}
    try{found.set(id,projection(row));}catch{issues.push({system,record:ref(id),field:'payment',reason:'INVALID_PARENT'});}
  }
  return found;
}
function diff(a,b,path,record,issues){
  if(canonical(a)===canonical(b))return;
  if(obj(a)&&obj(b)){
    for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],path+'.'+key,record,issues);
  }else if(Array.isArray(a)&&Array.isArray(b)){
    if(a.length!==b.length)issues.push({record,field:path+'.length',reason:'DIFFERENT'});
    for(let i=0;i<Math.min(a.length,b.length);i++)diff(a[i],b[i],path+'['+i+']',record,issues);
  }else issues.push({record,field:path,reason:'DIFFERENT'});
}
/** Compare immutable payment IDs across distinct DB exports. Do not join by TIN. */
export function reconcile(taxpayerRows,officeRows){
  const issues=[],src=mapRows(taxpayerRows,'taxpayer',issues),dst=mapRows(officeRows,'office',issues);
  let matched=0,simulated=0,missingDhara=0,missingChallan=0,missingAllocationIds=0,missingSource=0,missingPayer=0,missingRecipient=0;
  for(const [id,p] of src){
    const record=ref(id),before=issues.length;
    if(/SIMULATED|DEMO/i.test(p.status))simulated++;
    if(!p.challan)missingChallan++;
    if(!p.source)missingSource++;
    if(!p.payer.id&&!p.payer.tin)missingPayer++;
    // Travel Tax is a passenger journey, not a taxpayer-TIN allocation.
    if(p.service!=='TRAVEL_TAX'&&!p.recipient&&!p.allocations.some(a=>a.recipient))missingRecipient++;
    if(p.allocations.some(a=>!a.id))missingAllocationIds++;
    if(p.service!=='TRAVEL_TAX' && (p.allocations.length?p.allocations.some(a=>!a.dhara):!p.dhara))missingDhara++;
    if(p.allocations.length){
      const ids=p.allocations.map(a=>a.id).filter(Boolean);
      const total=p.allocations.reduce((s,a)=>s+BigInt(a.amount??0),0n);
      if(total!==BigInt(p.amount)||ids.length!==new Set(ids).size||
         p.allocations.some(a=>!a.recipient||!a.year||a.amount===null))
        issues.push({record,field:'allocations',reason:'INVALID_TOTAL_OR_IDENTITY'});
    }
    const other=dst.get(id);
    if(!other){issues.push({record,field:'payment',reason:'MISSING_OFFICE'});continue;}
    for(const field of ['payment','service','origin','source','amount','status','payer','recipient','year',
      'dhara','challan','references','allocations','lines','raw'])diff(p[field],other[field],field,record,issues);
    if(before===issues.length)matched++;
  }
  for(const id of dst.keys())if(!src.has(id))issues.push({record:ref(id),field:'payment',reason:'UNEXPECTED_OFFICE'});
  const parityPassed=issues.length===0&&src.size===dst.size&&src.size>0;
  // Equality is not field completeness. Historical rows may agree despite
  // missing verified Dhara, challans or immutable allocation identifiers.
  const fieldComplete=parityPassed&&missingDhara===0&&missingChallan===0&&
    missingAllocationIds===0&&missingSource===0&&missingPayer===0&&missingRecipient===0;
  return {taxpayerCount:src.size,officeCount:dst.size,matched,simulated,missingDhara,missingChallan,
    missingAllocationIds,missingSource,missingPayer,missingRecipient,issues,parityPassed,fieldComplete,
    // SQL equality never proves settlement, taxpayer identity, authorization or deployment.
    releaseVerified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [a,b,v2]=process.argv.slice(2);
  if(!a||!b){console.error('Usage: phase4-reconcile.mjs taxpayer.json office.json [v2.json]');process.exitCode=2;}
  else try{
    const load=f=>JSON.parse(readFileSync(f,'utf8'));
    const originalRows=load(a),officeRows=load(b);
    const originalIds=new Set(originalRows.map(r=>r?.id));
    const historical=reconcile(originalRows,officeRows.filter(r=>originalIds.has(r?.id)));
    const report={historical};
    // V2 is the prospective primary; original is fallback only for records
    // that were not cloned. Identical cloned parents are deduplicated safely.
    if(v2){
      const result=reconcileThreeWay(originalRows,load(v2),officeRows);
      report.v2=result.v2;
      report.combined=result.combined;
      report.sourceProblems=result.sourceProblems;
    }
    console.log(JSON.stringify(report,null,2));
    // Fail closed: row equality alone cannot authorize a financial release.
    if(!historical.fieldComplete||historical.simulated>0||
      (v2&&(!report.combined.fieldComplete||report.combined.simulated>0)))process.exitCode=1;
  }catch(e){console.error('Reconciliation verification failed:',e.message);process.exitCode=2;}
}