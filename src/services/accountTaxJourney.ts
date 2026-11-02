import {supabase} from './supabaseClient';
import {safeReviewStatus} from './accountReviewHistory';

export type AccountJourneyItem={
  key:string;requestId:string;at:string;category:string;assessmentYear:string;
  label:string;source:'request'|'review_event';status:string;reference:string;
};
type RequestRow={id:string;owner_uid:string;category:string;assessment_year:string;request_status:string;submitted_at:string};
type EventRow={id:number|string;request_id:string;event_type:string;status_after:string;occurred_at:string};

function validInstant(value:unknown):value is string {
  return typeof value==='string' && !Number.isNaN(Date.parse(value)) && /^20\d{2}-/.test(value);
}
function parseRequests(rows:RequestRow[],ownerUid:string):RequestRow[]{
  for(const row of rows){
    if(row.owner_uid!==ownerUid || typeof row.id!=='string' || !/^[\da-f-]{36}$/i.test(row.id) ||
       typeof row.category!=='string'||typeof row.assessment_year!=='string'||
       !/^20\d{2}-(?:20\d{2}|\d{2})$/.test(row.assessment_year)||
       !validInstant(row.submitted_at))throw new Error('Unexpected account journey record.');
  }
  return rows;
}
/** Derive only recorded application-review events, not inferred Treasury or ledger milestones. */
export function projectAccountTaxJourney(ownerUid:string,requests:RequestRow[],events:EventRow[]):AccountJourneyItem[]{
  const own=parseRequests(requests,ownerUid);
  const byId=new Map(own.map(row=>[row.id,row]));
  const result:AccountJourneyItem[]=own.map(row=>({
    key:'request:'+row.id,requestId:row.id,at:row.submitted_at,category:row.category,
    assessmentYear:row.assessment_year,label:'SUBMITTED_FOR_REVIEW',source:'request',
    status:safeReviewStatus(row.request_status),reference:row.id,
  }));
  for(const event of events){
    const request=byId.get(event.request_id);
    if(!request|| !validInstant(event.occurred_at)||
      typeof event.event_type!=='string'||!event.event_type||
      (typeof event.id!=='number'&&typeof event.id!=='string'))throw Error('Unexpected account review event.');
    result.push({key:'event:'+event.id,requestId:request.id,at:event.occurred_at,
      category:request.category,assessmentYear:request.assessment_year,
      label:event.event_type,source:'review_event',status:safeReviewStatus(event.status_after),
      reference:request.id});
  }
  return result.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.key.localeCompare(b.key));
}

/** Existing owner-scoped TaxPay request/event tables; no new financial source or write. */
export async function loadAccountTaxJourney(ownerUid:string):Promise<AccountJourneyItem[]> {
  const db=supabase;
  if(!db)throw new Error('Account service is unavailable.');
  const check=async()=>{
    const {data,error}=await db.auth.getUser();
    if(error||data.user?.id!==ownerUid)throw Error('Account session changed.');
  };
  await check();
  const requests:RequestRow[]=[];
  const pageSize=200;
  for(let offset=0;;offset+=pageSize){
    await check();
    const {data,error}=await db.from('taxpay_payment_requests')
      .select('id,owner_uid,category,assessment_year,request_status,submitted_at')
      .eq('owner_uid',ownerUid).order('submitted_at',{ascending:true})
      .order('id',{ascending:true}).range(offset,offset+pageSize-1);
    if(error)throw error;
    const page=(data??[]) as RequestRow[];
    requests.push(...page);
    if(page.length<pageSize)break;
  }
  const owned=parseRequests(requests,ownerUid);
  const events:EventRow[]=[];
  for(let offset=0;offset<owned.length;offset+=100){
    await check();
    const ids=owned.slice(offset,offset+100).map(x=>x.id);
    for(let pageFrom=0;;pageFrom+=pageSize){
      await check();
      const {data,error}=await db.from('taxpay_request_events')
        .select('id,request_id,event_type,status_after,occurred_at')
        .in('request_id',ids).order('occurred_at',{ascending:true})
        .order('id',{ascending:true}).range(pageFrom,pageFrom+pageSize-1);
      if(error)throw error;
      const page=(data??[]) as EventRow[];
      events.push(...page);
      if(page.length<pageSize)break;
    }
  }
  await check();
  return projectAccountTaxJourney(ownerUid,owned,events);
}
