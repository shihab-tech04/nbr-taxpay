import React,{useEffect,useRef,useState} from 'react';
import {TaxPayDataGrid,TaxPayTableCounter,TaxPayTableState} from '../ui/TaxPayDataTable';
import {formatCurrency} from '../../services/numberFormat';
import {
  acknowledgeReceivedPaymentNotice,listReceivedPaymentNotices,
  type StoredReceivedPaymentNotice,
} from '../../services/demoReceivedPaymentNotices';

type Snapshot={owner:string|null;status:'loading'|'ready'|'error';rows:StoredReceivedPaymentNotice[]};

/** Only the server-issued preview capability determines whose payment allocation
 * appears here. Never include payer's private head/lines or a payment-success claim.
 * Read receipts stay accessible after the first-login popup is acknowledged.
 */
export function ReceivedPaymentNoticeRegister({profileId,language}:{
  profileId:string;language:'en'|'bn';
}){
  const enabled=import.meta.env.VITE_RECIPIENT_NOTICE_FEED_ENABLED==='true';
  const [state,setState]=useState<Snapshot>({owner:null,status:'loading',rows:[]});
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [ackError,setAckError]=useState('');
  const busyRef=useRef<string|null>(null);
  const bn=language==='bn';
  const tr=(en:string,bengali:string)=>bn?bengali:en;
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    setState({owner:profileId,status:'loading',rows:[]});
    setAckError('');setBusy(null);busyRef.current=null;
    const load=async()=>{
      if(busyRef.current)return;
      try{
        const rows=await listReceivedPaymentNotices(profileId);
        if(active&&busyRef.current===null)
          setState({owner:profileId,status:'ready',rows});
      }catch{
        if(active&&busyRef.current===null)
          setState(previous=>previous.owner===profileId&&previous.status==='ready'
            ?previous:{owner:profileId,status:'error',rows:[]});
      }
    };
    void load();
    const refresh=()=>void load();
    window.addEventListener('online',refresh);
    window.addEventListener('focus',refresh);
    const timer=window.setInterval(refresh,7000);
    return()=>{
      active=false;window.clearInterval(timer);
      window.removeEventListener('online',refresh);
      window.removeEventListener('focus',refresh);
    };
  },[profileId,revision,enabled]);

  const acknowledge=async(notice:StoredReceivedPaymentNotice)=>{
    if(busyRef.current||notice.isRead||state.owner!==profileId)return;
    busyRef.current=notice.eventId;setBusy(notice.eventId);setAckError('');
    try{
      await acknowledgeReceivedPaymentNotice(profileId,notice.eventId);
      const rows=await listReceivedPaymentNotices(profileId);
      const confirmed=rows.find(row=>row.eventId===notice.eventId);
      if(!confirmed?.isRead||!confirmed.acknowledgedAt)
        throw Error('Read acknowledgement has not been verified');
      setState(previous=>previous.owner===profileId?{owner:profileId,status:'ready',rows}:previous);
    }catch{
      setAckError(tr('Read acknowledgement could not be verified. Retry.',
        'পঠিত নিশ্চিত করা যায়নি। আবার চেষ্টা করুন।'));
    }finally{busyRef.current=null;setBusy(null);}
  };
  if(!enabled)return null;
  const current=state.owner===profileId?state:{owner:profileId,status:'loading' as const,rows:[]};
  const rows=current.rows;
  return <section className="taxpayer-records-panel rounded-xl border border-taxpay-border bg-white p-4 sm:p-6"
    data-testid="received-payment-notice-register"
    aria-label={tr('Received payment notices','প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি')}>
    <div className="taxpay-table-toolbar">
      <h2 className="text-base font-semibold text-taxpay-text">
        {tr('Received payment notices','প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি')}
      </h2>
      <TaxPayTableCounter label={tr('Notices','বিজ্ঞপ্তি')}
        shown={rows.length} total={rows.length}/>
    </div>
    <p className="mt-1 text-sm text-taxpay-muted">
      {tr('Saved recipient allocations, including notices already read. These are payment records, not Treasury settlement or tax credit.',
        'ইতিমধ্যে পঠিত বিজ্ঞপ্তিসহ সংরক্ষিত প্রাপকের বরাদ্দ। এগুলো পেমেন্টের রেকর্ড, ট্রেজারি নিষ্পত্তি বা কর ক্রেডিট নয়।')}
    </p>
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
          :<TaxPayDataGrid variant="tabular" rows={rows} getRowKey={row=>row.eventId}
            ariaLabel={tr('Received payment register','প্রাপ্ত পেমেন্টের তালিকা')}
            mobileTestId="received-payment-notice-cards"
            columns={[
              {key:'reference',header:tr('Reference','রেফারেন্স'),renderCell:row=>
                <p className="break-all text-sm font-mono-plex">{row.receiptReference??row.paymentId}</p>},
              {key:'year',header:tr('Assessment year / head','করবর্ষ / খাত'),renderCell:row=>
                <p>{row.assessmentYear} · {row.headId??row.serviceCode??'—'}</p>},
              {key:'amount',header:tr('Your allocation','আপনার বরাদ্দ'),
                headerClassName:'text-right',cellClassName:'text-right tabular-nums',renderCell:row=>
                <p className="font-semibold">{formatCurrency(row.amountMinor/100,language)}</p>},
              {key:'read',header:tr('Status / action','অবস্থা / কার্যক্রম'),renderCell:row=>
                row.isRead
                  ?<span>{tr('Read','পঠিত')}</span>
                  :<button type="button" disabled={busy!==null}
                    className="min-h-11 rounded-lg border border-taxpay-border px-3 text-sm font-medium text-taxpay-primary"
                    onClick={()=>void acknowledge(row)}>
                    {busy===row.eventId?tr('Confirming…','নিশ্চিত করা হচ্ছে…'):tr('Mark as read','পঠিত করুন')}
                  </button>},
            ]}/>}
  </section>;
}
