import {useEffect,useRef,useState} from 'react';
import {TaxPayModal} from '../ui/TaxPayModal';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import {receivedPaymentNoticePresentation} from '../../services/receivedPaymentNoticePresentation';
import {ReceivedPaymentNoticeDetails} from './ReceivedPaymentNoticeDetails';
import {queueReceivedPaymentCaseIntent} from '../../services/receivedPaymentCaseIntent';
import {loadAccountUnreadReceivedPayments,acknowledgeAccountReceivedPayment}
  from '../../services/accountReceivedPaymentNotices';
import type {ReceivedPaymentNotice} from '../../services/demoReceivedPaymentNotices';
import type {CorrectionCaseKind} from '../../services/correctionInquiryValidation';

const WELCOME_KEY='sohojkor.verified-auth-welcome.v1';

/** Only a confirmed Auth user with an already APPROVER-BOUND registered TIN can
 * receive this SQL feed. The user cannot type a TIN to opt into another account.
 * Enable only once the live SQL migration, owner-binding and Office handoff
 * acceptance have passed. This never labels a recorded row as a tax credit.
 */
export function AuthenticatedReceivedPaymentPopup() {
  const {user}=useAccountIdentity();
  const {language,navigate,currentRoute}=useTaxState();
  const uid=user?.id??null;
  const activeUid=useRef<string|null>(uid);
  activeUid.current=uid;
  const bn=language==='bn';
  const [owner,setOwner]=useState<string|null>(null);
  const [welcomeOwner,setWelcomeOwner]=useState<string|null>(null);
  const [items,setItems]=useState<ReceivedPaymentNotice[]>([]);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const ackLock=useRef<object|null>(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    ackLock.current=null;
    setOwner(uid);setItems([]);setDismissed([]);setError('');setBusy(false);
    try {setWelcomeOwner(uid&&sessionStorage.getItem(WELCOME_KEY)===uid?uid:null);}
    catch {setWelcomeOwner(null);}
  },[uid]);

  useEffect(()=>{
    if(!uid||import.meta.env.VITE_ACCOUNT_RECEIVED_NOTICES_ENABLED!=='true')return;
    let active=true;
    const read=async()=>{
      try {
        const received=await loadAccountUnreadReceivedPayments(uid);
        if(active)setItems(received);
      }catch {if(active)setItems([]);} // Do not show another owner's stale rows.
    };
    void read();
    const timer=window.setInterval(()=>void read(),30000);
    return()=>{active=false;clearInterval(timer);};
  },[uid]);

  if(!uid||owner!==uid)return null;
  const next=items.find(x=>!dismissed.includes(x.eventId))??null;
  // A stored sign-in greeting cannot open without a verified unread notice.
  if(welcomeOwner===uid && next!==null && next.paymentStatus!=='SIMULATED_SUCCESS' && currentRoute!=='taxpayer_login' && currentRoute!=='corrections') {
    const close=()=>{
      try{sessionStorage.removeItem(WELCOME_KEY);}catch{/* Greeting is optional. */}
      setWelcomeOwner(null);
    };
    return <TaxPayModal title={bn?'সহজকরে স্বাগতম':'Welcome to Sohojkor'}
      onClose={close} closeIconLabel={bn?'বন্ধ করুন':'Close modal'}
      className="taxpayer-authorization-modal"
      footer={<button type="button" className="tax-service-choice__continue taxpayer-welcome__action"
        onClick={close}>{bn?'বিজ্ঞপ্তি দেখুন':'Continue to notifications'}</button>}>
      <p role="status" className="mt-4 text-sm leading-6 text-taxpay-text">
        {bn
          ?'আপনার অ্যাকাউন্টে নতুন প্রাপ্ত পেমেন্টের বিজ্ঞপ্তি আছে। সেগুলো একে একে দেখুন।'
          :'You have unread received-payment notifications. Review them one at a time.'}
      </p>
    </TaxPayModal>;
  }
  if(!next||currentRoute==='corrections')return null;
  const openCase=(kind:CorrectionCaseKind)=>{
    try {
      queueReceivedPaymentCaseIntent(next,kind);
      setError('');navigate('corrections');
    }catch{
      setError(bn?'অনুরোধ প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।':'Could not prepare the request. Please retry.');
    }
  };
  const ack=async()=>{
    if(ackLock.current)return;
    const operation={};ackLock.current=operation;
    setBusy(true);setError('');
    try{
      await acknowledgeAccountReceivedPayment(uid,next.eventId);
      const updated=await loadAccountUnreadReceivedPayments(uid);
      if(updated.some(item=>item.eventId===next.eventId))
        throw Error('Acknowledgment was not verified.');
      if(activeUid.current===uid&&ackLock.current===operation){
        setDismissed(old=>[...old,next.eventId]);setItems(updated);
      }
    }catch{
      if(activeUid.current===uid&&ackLock.current===operation)
        setError(bn?'বিজ্ঞপ্তির পঠন নিশ্চিত করা যায়নি। আবার চেষ্টা করুন।':'Could not confirm the notice read state. Please retry.');
    }finally{if(ackLock.current===operation){ackLock.current=null;setBusy(false);}}
  };
  return <TaxPayModal title={receivedPaymentNoticePresentation(next,language,true).title}
    onClose={()=>void ack()} closeIconLabel={bn?'বন্ধ করুন':'Close modal'}
    className="taxpayer-authorization-modal"
    footer={<div className="tax-service-choice__actions flex flex-wrap gap-2">
      <button type="button" className="taxpay-modal__footer-close" disabled={busy}
        data-testid="received-notice-close" onClick={()=>void ack()}>{busy?(bn?'নিশ্চিত করা হচ্ছে…':'Confirming…'):(bn?'বন্ধ করুন':'Close')}</button>
      <button type="button" className="tax-service-choice__continue" disabled={busy}
        onClick={()=>openCase('UNSOLICITED_PAYMENT_REPORT')}>{bn?'পেমেন্ট রিপোর্ট করুন':'Report Payment'}</button>
    </div>}>
    <div className="mt-4 space-y-3" data-testid="authenticated-received-payment-notice">
      <p className="text-sm text-taxpay-text">
        {bn?'আপনার যাচাইকৃত করদাতা প্রোফাইলে একটি পেমেন্ট রেকর্ড হয়েছে।':'A payment has been recorded for your verified taxpayer profile.'}
      </p>
      <p className="text-sm text-taxpay-text">{bn?'পেমেন্টের বিবরণ যাচাই করুন। পেমেন্টটি অপরিচিত বা আপনার অনুমতি ছাড়া করা হয়েছে বলে মনে হলে রিপোর্ট করতে পারেন।':'Please review the payment details below. If you do not recognize this payment or believe it was initiated without your authorization, you can report it.'}</p>
        <ReceivedPaymentNoticeDetails notice={next} language={language}/>
      <p className="text-xs text-taxpay-muted">
        {bn?'শুধু নথিভুক্ত পেমেন্ট; সরকারি নিষ্পত্তি বা কর ক্রেডিট নিশ্চিত নয়।':'Recorded payment only; settlement and tax credit are not confirmed.'}
      </p>
      {error&&<p className="text-sm text-taxpay-error" role="alert">{error}</p>}
    </div>
  </TaxPayModal>;
}
