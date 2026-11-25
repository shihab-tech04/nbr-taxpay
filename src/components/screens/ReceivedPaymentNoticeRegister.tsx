import React,{useEffect,useRef,useState} from 'react';
import {TaxPayDataGrid,TaxPayTableCounter,TaxPayTableState,TaxPayTableControls} from '../ui/TaxPayDataTable';
import {receivedPaymentNoticePresentation} from '../../services/receivedPaymentNoticePresentation';
import {projectRecipientPaymentActivity,formatRecipientCompletedMinor} from '../../services/recipientPaymentActivity';
import {TaxPayModal} from '../ui/TaxPayModal';
import {ReceivedPaymentNoticeDetails} from './ReceivedPaymentNoticeDetails';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {queueReceivedPaymentCaseIntent} from '../../services/receivedPaymentCaseIntent';
import {listAccountReceivedPayments,acknowledgeAccountReceivedPayment} from '../../services/accountReceivedPaymentNotices';
import {resolveReceivedNoticeRegisterScope} from '../../services/receivedNoticeRegisterScope';
import type {CorrectionCaseKind} from '../../services/correctionInquiryValidation';
import {
  acknowledgeReceivedPaymentNotice,listReceivedPaymentNotices,filterStoredReceivedPaymentNotices,
  type StoredReceivedPaymentNotice,
} from '../../services/demoReceivedPaymentNotices';

type Snapshot={owner:string|null;status:'loading'|'ready'|'error';rows:StoredReceivedPaymentNotice[]};

/** Only the server-issued preview capability determines whose payment allocation
 * appears here. Never include payer's private head/lines or a payment-success claim.
 * Read receipts stay accessible after the first-login popup is acknowledged.
 */
export function ReceivedPaymentNoticeRegister({profileId,authOwnerUid,language,context='notifications',assessmentYear}:{
  profileId?:string;authOwnerUid?:string;language:'en'|'bn';context?:'notifications'|'activity'|'dashboard';assessmentYear?:string;
}){
  const {navigate}=useTaxState();
  const {user:authenticatedUser}=useAccountIdentity();
  const scope=resolveReceivedNoticeRegisterScope({
    profileId,authOwnerUid,authenticatedUid:authenticatedUser?.id??null,
    realFeedEnabled:import.meta.env.VITE_ACCOUNT_RECEIVED_NOTICES_ENABLED==='true',
    previewFeedEnabled:import.meta.env.VITE_RECIPIENT_NOTICE_FEED_ENABLED==='true',
  });
  const enabled=scope!==null;
  const owner=scope?.ownerKey??'';
  const mode=scope?.mode??null;
  const [state,setState]=useState<Snapshot>({owner:null,status:'loading',rows:[]});
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [ackError,setAckError]=useState('');
  const [search,setSearch]=useState('');
  const [detail,setDetail]=useState<{owner:string;eventId:string}|null>(null);
  const [readFilter,setReadFilter]=useState<'all'|'read'|'unread'>('all');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const busyRef=useRef<string|null>(null);
  // Older in-flight polls must not overwrite newer reads or a confirmed ACK.
  const loadRevisionRef=useRef(0);
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    setState({owner,status:'loading',rows:[]});
    setAckError('');setBusy(null);busyRef.current=null;
    setSearch('');setReadFilter('all');setDateFrom('');setDateTo('');setDetail(null);
    const load=async()=>{
      if(busyRef.current)return;
      const requestRevision=++loadRevisionRef.current;
      try{
        const rows=mode==='auth'&&authOwnerUid
          ?await listAccountReceivedPayments(authOwnerUid)
          :await listReceivedPaymentNotices(profileId!);
        if(active&&requestRevision===loadRevisionRef.current&&busyRef.current===null)
          setState({owner,status:'ready',rows});
      }catch{
        if(active&&requestRevision===loadRevisionRef.current&&busyRef.current===null)
          setState(previous=>previous.owner===owner&&previous.status==='ready'
            ?previous:{owner,status:'error',rows:[]});
      }
    };
    void load();
    const refresh=()=>void load();
    window.addEventListener('online',refresh);
    window.addEventListener('focus',refresh);
    const timer=window.setInterval(refresh,7000);
    return()=>{
      active=false;loadRevisionRef.current++;window.clearInterval(timer);
      window.removeEventListener('online',refresh);
      window.removeEventListener('focus',refresh);
    };
  },[profileId,authOwnerUid,owner,mode,revision,enabled]);

  const openCase=(notice:StoredReceivedPaymentNotice,caseKind:CorrectionCaseKind)=>{
    if(state.owner!==owner||!enabled)return;
    try{
      queueReceivedPaymentCaseIntent(notice,caseKind);
      if(authenticatedUser)navigate('corrections');
      else navigate('secure_workspace',{returnTo:'corrections'});
    }catch{
      setAckError(tr('Could not prepare the request. Please retry.',
        'অনুরোধের তথ্য প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।'));
    }
  };

  const acknowledge=async(notice:StoredReceivedPaymentNotice)=>{
    if(busyRef.current||notice.isRead||state.owner!==owner||!enabled)return;
    busyRef.current=notice.eventId;setBusy(notice.eventId);setAckError('');
    // Invalidate every poll begun before the acknowledgement was requested.
    const requestRevision=++loadRevisionRef.current;
    try{
      if(mode==='auth'&&authOwnerUid)
        await acknowledgeAccountReceivedPayment(authOwnerUid,notice.eventId);
      else await acknowledgeReceivedPaymentNotice(profileId!,notice.eventId);
      const rows=mode==='auth'&&authOwnerUid
        ?await listAccountReceivedPayments(authOwnerUid)
        :await listReceivedPaymentNotices(profileId!);
      const confirmed=rows.find(row=>row.eventId===notice.eventId);
      if(!confirmed?.isRead||!confirmed.acknowledgedAt)
        throw Error('Read acknowledgement has not been verified');
      if(requestRevision===loadRevisionRef.current)
        setState(previous=>previous.owner===owner?{owner,status:'ready',rows}:previous);
    }catch{
      if(requestRevision===loadRevisionRef.current)
        setAckError(tr('Read acknowledgement could not be verified. Retry.',
          'পঠিত নিশ্চিত করা যায়নি। আবার চেষ্টা করুন।'));
    }finally{
      if(busyRef.current===notice.eventId){busyRef.current=null;setBusy(null);}
    }
  };
  if(!enabled)return null;
  const current=state.owner===owner?state:{owner,status:'loading' as const,rows:[]};
  const projection=context==='notifications'?null:projectRecipientPaymentActivity(current.rows,assessmentYear);
  const rows=projection?.rows??current.rows;
  const selected=detail?.owner===owner?rows.find(row=>row.eventId===detail.eventId):undefined;
  const heading=context==='notifications'?tr('Received payment notices','প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি'):tr('Payments made on your behalf','আপনার পক্ষ থেকে করা পেমেন্ট');
  const filtered=filterStoredReceivedPaymentNotices(rows,{
    query:search,readStatus:readFilter,dateFrom,dateTo,displayLanguage:language
  });
  const invalidDates=Boolean(dateFrom&&dateTo&&dateFrom>dateTo);
  return <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6"
    data-testid={context==='notifications'?'received-payment-notice-register':context==='dashboard'?'recipient-dashboard-payments':'recipient-activity-payments'}
    aria-label={heading}>
    <div className="taxpay-table-toolbar">
      <h2 className="text-base font-semibold text-taxpay-text">
        {heading}
      </h2>
      <TaxPayTableCounter label={context==='notifications'?tr('Notices','বিজ্ঞপ্তি'):tr('Allocations','বরাদ্দ')}
        shown={filtered.length} total={rows.length}/>
    </div>
    <p className="mt-1 text-sm text-taxpay-muted">
      {tr('Saved recipient allocations, including notices already read. These are payment records, not Treasury settlement or tax credit.',
        'ইতিমধ্যে পঠিত বিজ্ঞপ্তিসহ সংরক্ষিত প্রাপকের বরাদ্দ। এগুলো পেমেন্টের রেকর্ড, ট্রেজারি নিষ্পত্তি বা কর ক্রেডিট নয়।')}
    </p>
    {projection&&projection.inconsistentAllocationCount>0&&<p role="alert" className="mt-2 text-sm text-taxpay-error">{tr('Some allocation records conflict. Completed totals exclude them.','কিছু বরাদ্দের রেকর্ডে অমিল রয়েছে। সম্পন্ন মোট পরিমাণে সেগুলো বাদ দেওয়া হয়েছে।')}</p>}
    {projection&&current.status==='ready'&&<div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1" data-testid="recipient-completed-summary">
      <p className="text-sm text-taxpay-muted">{tr('Completed payments received','প্রাপ্ত সম্পন্ন পেমেন্ট')}: <strong className="text-taxpay-text tabular-nums">{projection.completedPaymentCount.toLocaleString(bn?'bn-BD':'en-BD')}</strong></p>
      <p className="text-sm text-taxpay-muted">{tr('Completed allocation total','সম্পন্ন বরাদ্দের মোট পরিমাণ')}: <strong className="text-taxpay-text tabular-nums">{formatRecipientCompletedMinor(projection.completedMinor,language)}</strong></p>
    </div>}
    <TaxPayTableControls className="taxpayer-transaction-filters taxpay-record-page-filters">
      <label className="taxpayer-transaction-filter">
        <span>{tr('Find a received notice','প্রাপ্ত বিজ্ঞপ্তি খুঁজুন')}</span>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"
          placeholder={tr('Reference, payer, tax type or year','রেফারেন্স, পেমেন্টকারী, করের ধরন বা করবর্ষ')}/>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('Read status','পঠিত অবস্থা')}</span>
        <select value={readFilter} onChange={e=>setReadFilter(e.target.value as 'all'|'read'|'unread')}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm">
          <option value="all">{tr('All notices','সব বিজ্ঞপ্তি')}</option>
          <option value="unread">{tr('Unread','অপঠিত')}</option>
          <option value="read">{tr('Read','পঠিত')}</option>
        </select>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('From date','শুরুর তারিখ')}</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </label>
      <label className="taxpayer-transaction-filter">
        <span>{tr('To date','শেষ তারিখ')}</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-taxpay-border bg-white px-3 text-sm"/>
      </label>
      {(search||readFilter!=='all'||dateFrom||dateTo)&&<button type="button"
        className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary"
        onClick={()=>{setSearch('');setReadFilter('all');setDateFrom('');setDateTo('');}}>
        {tr('Clear filters','ফিল্টার মুছুন')}
      </button>}
    </TaxPayTableControls>
    {invalidDates&&<p role="alert" className="mt-2 text-sm text-taxpay-error">
      {tr('End date must be on or after start date.','শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।')}
    </p>}
    {ackError&&<p role="alert" className="mt-2 text-sm text-taxpay-error">{ackError}</p>}
    {current.status==='loading'
      ?<p role="status" className="mt-3 text-sm text-taxpay-muted">
        {tr('Loading received notices…','প্রাপ্ত বিজ্ঞপ্তি লোড হচ্ছে…')}</p>
      :current.status==='error'
        ?<div className="mt-3 space-y-2" role="alert">
          <p>{tr('Could not verify received notices.','প্রাপ্ত বিজ্ঞপ্তি যাচাই করা যায়নি।')}</p>
          <button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3"
            onClick={()=>setRevision(v=>v+1)}>{tr('Retry','আবার চেষ্টা করুন')}</button>
        </div>
        :rows.length===0
          ?<TaxPayTableState>{tr('No received payments recorded.','এখনো প্রাপ্ত পেমেন্ট নেই।')}</TaxPayTableState>
          :filtered.length===0
            ?<TaxPayTableState>{tr('No received notices match these filters.','এই ফিল্টারে কোনো প্রাপ্ত বিজ্ঞপ্তি নেই।')}</TaxPayTableState>
          :<TaxPayDataGrid variant="tabular" rows={filtered} getRowKey={row=>row.eventId}
            ariaLabel={tr('Received payment register','প্রাপ্ত পেমেন্টের তালিকা')}
            mobileTestId="received-payment-notice-cards"
            columns={[
              {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:row=>
                <div><p className="break-all text-sm font-mono-plex">{row.receiptReference??row.paymentId}</p>
                  <p className="text-sm text-taxpay-muted">{receivedPaymentNoticePresentation(row,language).payer}</p></div>},
              {key:'year',header:tr('Assessment year / tax type','করবর্ষ / করের ধরন'),renderCell:row=>
                <p>{row.assessmentYear} · {receivedPaymentNoticePresentation(row,language).category}</p>},
              {key:'amount',header:tr('Your allocation','আপনার বরাদ্দ'),
                headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:row=>
                <p className="font-semibold">{receivedPaymentNoticePresentation(row,language).amount}</p>},
              {key:'date',header:tr('Date and time','তারিখ ও সময়'),renderCell:row=>
                <time dateTime={row.createdAt}>
                  {receivedPaymentNoticePresentation(row,language).dateTime}
                </time>},
              {key:'read',header:tr('Status / action','অবস্থা / কার্যক্রম'),renderCell:row=>
                <div className="flex flex-wrap items-center gap-2">
                  {context!=='notifications'&&<button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary" onClick={()=>setDetail({owner,eventId:row.eventId})}>{tr('Details','বিস্তারিত')}</button>}
                  <span className="w-full text-sm font-semibold">{receivedPaymentNoticePresentation(row,language).status}</span>
                  {row.isRead
                    ?<span className="text-sm text-taxpay-muted">{tr('Read','পঠিত')}</span>
                    :<button type="button" disabled={busy!==null}
                      className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary"
                      onClick={()=>void acknowledge(row)}>
                      {busy===row.eventId?tr('Confirming…','নিশ্চিত করা হচ্ছে…'):tr('Mark as read','পঠিত করুন')}
                    </button>}
                  <button type="button" disabled={busy!==null}
                    className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary"
                    onClick={()=>openCase(row,'CORRECTION_REVIEW')}>
                    {tr('Request correction','সংশোধনের অনুরোধ')}
                  </button>
                  <button type="button" disabled={busy!==null}
                    className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary"
                    onClick={()=>openCase(row,'UNSOLICITED_PAYMENT_REPORT')}>
                    {tr('Report payment','পেমেন্ট রিপোর্ট করুন')}
                  </button>
                </div>},
            ]}/>}
    {selected&&<TaxPayModal title={tr('Payment details','পেমেন্টের বিস্তারিত')} onClose={()=>setDetail(null)}
      footer={<><button type="button" className="min-h-11 rounded-lg border border-taxpay-border px-4" onClick={()=>setDetail(null)}>{tr('Close','বন্ধ করুন')}</button>
        <button type="button" className="min-h-11 rounded-lg bg-taxpay-primary px-4 text-white" onClick={()=>{setDetail(null);openCase(selected,'UNSOLICITED_PAYMENT_REPORT');}}>{tr('Report Payment','পেমেন্ট রিপোর্ট করুন')}</button></>}>
      <ReceivedPaymentNoticeDetails notice={selected} language={language}/>
    </TaxPayModal>}
  </section>;
}
