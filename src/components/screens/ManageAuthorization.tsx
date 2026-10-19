import React, { useEffect, useState } from 'react';
import { Clock3, Plus, RefreshCw, ShieldCheck, ShieldX, Trash2, UsersRound, X } from 'lucide-react';
import { DEMO_USERS, type DemoUserId } from '../../data/demoUsers';
import { sampleJourneysEnabled, useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { TaxpayerPageHeading } from '../layout/TaxpayerPageStructure';
import {
  AuthorizationSyncError, getHostedAuthorizations, performHostedAuthorization,
  retryHostedAuthorizationSync, userIdForHostedTin, type HostedAuthorization,
  type HostedAuthorizationStatus,
} from '../../services/hostedDemoAuthorizations';

type Tab = 'outgoing' | 'incoming';

export function ManageAuthorization() {
  const { language, previewAccount, demoUser, navigate } = useTaxState();
  const { user: applicationUser } = useAccountIdentity();
  const bn = language === 'bn';
  const tr = (en: string, bengali: string) => bn ? bengali : en;
  const actor = previewAccount?.id ?? (sampleJourneysEnabled ? demoUser?.id : undefined);
  const [tab, setTab] = useState<Tab>('outgoing');
  const [records, setRecords] = useState<HostedAuthorization[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncPending, setSyncPending] = useState<string|null>(null);
  const [adding, setAdding] = useState(false);
  const [tin, setTin] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  useEffect(()=>{
    try{
      if(sessionStorage.getItem('taxpay-authorization-open-tab')==='incoming'){
        setTab('incoming');sessionStorage.removeItem('taxpay-authorization-open-tab');
      }
    }catch{/* optional navigation hint */}
  },[]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = async (user:DemoUserId) => {
    const next=await getHostedAuthorizations(user);
    setRecords(next);
  };
  useEffect(() => {
    if(!actor){setRecords([]);return;}
    let active=true;
    setRecords([]);setLoading(true);
    const poll=async()=>{
      try{const data=await getHostedAuthorizations(actor);if(active){setRecords(data);setFeedback(prev=>prev?.error?prev:null);}}
      catch(error){if(active)setFeedback({error:true,message:error instanceof Error?error.message:'Authorization service unavailable'});}
      finally{if(active)setLoading(false);}
    };
    void poll();const timer=window.setInterval(()=>void poll(),5000);
    return()=>{active=false;window.clearInterval(timer);};
  },[actor]);
  useEffect(() => { setFeedback(null); setAdding(false); setTin(''); setCodes({}); setRemoveId(null);setDeleteId(null);setSyncPending(null); }, [actor]);

  const runAction=async(action:()=>Promise<unknown>,success:string)=>{
    if(!actor||busy)return;
    setBusy(true);setFeedback(null);
    try{
      await action();await refresh(actor);
      setFeedback({error:false,message:success});
    }catch(error){
      if(error instanceof AuthorizationSyncError)setSyncPending(error.requestId);
      setFeedback({error:true,message:error instanceof Error?error.message:'Authorization service unavailable'});
      if(actor)try{await refresh(actor);}catch{/* keep first error */}
    }finally{setBusy(false);}
  };
  const sendRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!actor) return;
    const target = userIdForHostedTin(tin);
    if (!/^\d{13}$/.test(tin.trim())) {
      setFeedback({ error: true, message: tr('Enter a 13-digit test taxpayer TIN.', 'করদাতার ১৩ সংখ্যার পরীক্ষামূলক টিআইএন লিখুন।') });
      return;
    }
    if (!target) {
      setFeedback({ error: true, message: tr('No test taxpayer matches this TIN.', 'এই টিআইএন-এ কোনো পরীক্ষামূলক করদাতা নেই।') });
      return;
    }
    await runAction(async()=>{
      await performHostedAuthorization(actor,'request',{tin});
      setTin('');setAdding(false);
    },tr('Request sent. The taxpayer will receive a notification and approval prompt.','অনুরোধ পাঠানো হয়েছে। করদাতা বিজ্ঞপ্তি ও অনুমোদনের বার্তা পাবেন।'));
  };
  const confirmCode = (record: HostedAuthorization) => {
    if (!actor) return;
    void runAction(async()=>{
      const outcome=await performHostedAuthorization(actor,'confirm',{id:record.id,code:codes[record.id]??''});
      setCodes(before=>({...before,[record.id]:''}));
      if(outcome.status!=='ACTIVE')throw Error(tr('Incorrect code. Three attempts will decline the request.','ভুল কোড। তিনবার চেষ্টা করলে অনুরোধ বাতিল হবে।'));
    },tr('Authorization is active. You can now pay for this taxpayer.','অনুমোদন সক্রিয়। এখন এই করদাতার হয়ে পরিশোধ করতে পারবেন।'));
  };
  const changeStatus = (record: HostedAuthorization, operation: 'revoke' | 'decline' | 'accept') => {
    if (!actor) return;
    void runAction(async()=>{
      await performHostedAuthorization(actor,operation,{id:record.id});
      setRemoveId(null);
    },operation==='revoke'?tr('Authorization removed.','অনুমোদন বাতিল করা হয়েছে।'):
      operation==='accept'?tr('Accepted. Share your four-digit code with the requester.','গৃহীত। অনুরোধকারীকে চার সংখ্যার কোড দিন।'):
      tr('Request declined.','অনুরোধ প্রত্যাখ্যান করা হয়েছে।'));
  };
  const resendCode = (record: HostedAuthorization) => {
    if (!actor) return;
    void runAction(async () => {
      await performHostedAuthorization(actor, 'resend', { id: record.id });
      setCodes(before => ({ ...before, [record.id]: '' }));
    }, tr('New code sent to the taxpayer. The previous code is no longer valid.', 'করদাতাকে নতুন কোড পাঠানো হয়েছে। আগের কোড আর কার্যকর নয়।'));
  };
  const deleteAuthorization = (record: HostedAuthorization) => {
    if (!actor) return;
    void runAction(async () => {
      await performHostedAuthorization(actor, 'delete', { id: record.id });
      setDeleteId(null);setRemoveId(null);
    }, tr('Authorization removed from your list. The audit record is preserved.', 'তালিকা থেকে অনুমোদন সরানো হয়েছে। নিরীক্ষার রেকর্ড সংরক্ষিত আছে।'));
  };
  const statusLabel = (status: HostedAuthorizationStatus) => ({
    ACTIVE: tr('Active', 'সক্রিয়'), PENDING: tr('Pending', 'অপেক্ষমাণ'), CODE_ISSUED:tr('Awaiting code','কোডের অপেক্ষায়'), EXPIRED: tr('Expired', 'মেয়াদোত্তীর্ণ'),
    REVOKED: tr('Revoked', 'বাতিল'), DENIED: tr('Declined', 'প্রত্যাখ্যাত'), CANCELLED: tr('Cancelled', 'বাতিল করা হয়েছে'),
  })[status];
  const timeLabel = (record: HostedAuthorization) => {
    const status = record.status;
    if (status === 'PENDING') return tr('Waiting for taxpayer consent', 'করদাতার সম্মতির অপেক্ষায়');
    if (status === 'CODE_ISSUED') return tr('Taxpayer accepted · waiting for four-digit confirmation', 'করদাতা গ্রহণ করেছেন · চার সংখ্যার নিশ্চিতকরণের অপেক্ষায়');
    if (status === 'ACTIVE') {
      return tr('Authorized until the taxpayer revokes access', 'করদাতা বাতিল না করা পর্যন্ত অনুমোদিত');
    }
    if (status === 'REVOKED') return tr('Access removed', 'অনুমতি বাতিল করা হয়েছে');
    if (status === 'DENIED') return tr('Request declined', 'অনুরোধ প্রত্যাখ্যাত');
    if (status === 'CANCELLED') return tr('Request cancelled', 'অনুরোধ বাতিল করা হয়েছে');
    return tr('Authorization expired', 'অনুমোদনের মেয়াদ শেষ');
  };
  const shown = records.filter(record => actor && (tab === 'outgoing' ? record.payerId === actor : record.taxpayerId === actor));

  return <section className="taxpayer-account-center taxpay-authorization" lang={language} aria-labelledby="manage-auth-title" data-testid="manage-authorization">
    <TaxpayerPageHeading id="manage-auth-title" className="taxpayer-account-heading"
      title={tr('Manage Authorization', 'অনুমোদন পরিচালনা')}
      description={tr('Choose who may facilitate income-tax payments for whom.', 'কে কার হয়ে আয়কর পরিশোধে সহায়তা করতে পারবেন, তা পরিচালনা করুন।')} />
    <nav className="taxpayer-account-tabs" aria-label={tr('Authorization direction', 'অনুমোদনের ধরন')}>
      <button type="button" aria-current={tab === 'outgoing' ? 'page' : undefined} onClick={() => { setTab('outgoing'); setFeedback(null); setAdding(false); }}>
        <UsersRound size={17} aria-hidden="true"/>{tr('I can pay for', 'আমি যাঁদের জন্য দিতে পারি')}
      </button>
      <button type="button" aria-current={tab === 'incoming' ? 'page' : undefined} onClick={() => { setTab('incoming'); setFeedback(null); setRemoveId(null); setDeleteId(null); }}>
        <ShieldCheck size={17} aria-hidden="true"/>{tr('Can pay for me', 'আমার হয়ে যাঁরা দিতে পারেন')}
      </button>
    </nav>

    {!actor ? <section className="taxpayer-account-panel taxpay-auth-empty">
      <ShieldX size={28} aria-hidden="true" />
      <h2>{tr('Account authorization', 'অ্যাকাউন্ট অনুমোদন')}</h2>
      <p>{applicationUser
        ? tr('Authorization management is currently available for the ten test taxpayers. The verified-account API is not connected to this test feature.', 'এই পরীক্ষামূলক সুবিধাটি আপাতত দশটি টেস্ট করদাতার জন্য উপলভ্য।')
        : tr('Sign in as user1–user10 to manage test authorizations.', 'পরীক্ষামূলক অনুমোদন পরিচালনা করতে user1–user10 দিয়ে সাইন ইন করুন।')}</p>
      {!applicationUser && <button type="button" className="taxpay-auth-primary" onClick={() => navigate('taxpayer_login')}>{tr('Sign in', 'সাইন ইন')}</button>}
    </section> : <section className="taxpayer-account-panel">
      <div className="taxpay-auth-heading-row">
        <div>
          <h2>{tab === 'outgoing' ? tr('Taxpayers who authorized me', 'যেসব করদাতা আমাকে অনুমোদন দিয়েছেন') : tr('People authorized to pay my tax', 'আমার কর পরিশোধের জন্য অনুমোদিত ব্যক্তি')}</h2>
          <p>{tab === 'outgoing'
            ? tr('Ask a taxpayer for consent or review existing permissions.', 'নতুন সম্মতি চান অথবা বিদ্যমান অনুমোদন দেখুন।')
            : tr('Review incoming requests and remove access whenever necessary.', 'অনুরোধ দেখুন এবং প্রয়োজনে অনুমোদন বাতিল করুন।')}</p>
        </div>
        {tab === 'outgoing' && <button type="button" className="taxpay-auth-primary" onClick={() => { setAdding(a => !a); setFeedback(null); }} aria-expanded={adding}>
          {adding ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
          {adding ? tr('Close', 'বন্ধ') : tr('Add', 'যোগ করুন')}
        </button>}
      </div>

      {adding && tab === 'outgoing' && <form className="taxpay-auth-add" onSubmit={e=>void sendRequest(e)}>
        <label htmlFor="new-auth-tin">{tr('Taxpayer TIN', 'করদাতার টিআইএন')}</label>
        <div className="taxpay-auth-inline">
          <input id="new-auth-tin" value={tin} onChange={e => setTin(e.target.value.replace(/\D/g, '').slice(0, 13))}
            inputMode="numeric" autoComplete="off" placeholder={tr('Enter 13-digit test TIN', '১৩ সংখ্যার পরীক্ষামূলক টিআইএন লিখুন')} required maxLength={13} />
          <button type="submit" className="taxpay-auth-primary" disabled={busy}>{busy?tr('Sending…','পাঠানো হচ্ছে…'):tr('Request authorization', 'অনুমোদন চান')}</button>
        </div>
        <p>{tr('The taxpayer accepts from their account, then shares a four-digit code with you to confirm.', 'করদাতা নিজের অ্যাকাউন্ট থেকে গ্রহণ করে আপনার সঙ্গে চার সংখ্যার কোড শেয়ার করবেন।')}</p>
      </form>}

      {feedback && <p className={`taxpay-auth-feedback ${feedback.error ? 'taxpay-auth-feedback--error' : ''}`} role="status">{feedback.message}</p>}
      {syncPending && <button type="button" className="taxpay-auth-outline" disabled={busy}
        onClick={()=>void runAction(async()=>{await retryHostedAuthorizationSync(syncPending);setSyncPending(null);},tr('Office synchronization confirmed.','অফিস সিঙ্ক নিশ্চিত হয়েছে।'))}>{tr('Retry Office synchronization','অফিস সিঙ্ক আবার চেষ্টা করুন')}</button>}
      {loading && <p role="status">{tr('Loading shared authorizations…','অনুমোদন লোড হচ্ছে…')}</p>}
      {!shown.length ? <div className="taxpay-auth-empty">
        <UsersRound size={30} strokeWidth={1.6} aria-hidden="true" />
        <h3>{tab === 'outgoing' ? tr('No authorizations yet', 'এখনো কোনো অনুমোদন নেই') : tr('No one is authorized yet', 'এখনো কেউ অনুমোদিত নন')}</h3>
        <p>{tab === 'outgoing'
          ? tr('Use Add to request permission to pay another taxpayer’s tax.', 'অন্য করদাতার কর পরিশোধের অনুমতি চাইতে যোগ করুন ব্যবহার করুন।')
          : tr('When someone requests to pay your tax, it will appear here for your decision.', 'কেউ আপনার কর পরিশোধের অনুমতি চাইলে এখানে দেখাবে।')}</p>
      </div> : <ul className="taxpay-auth-list">
        {shown.map(record => {
          const counterpart: DemoUserId = tab === 'outgoing' ? record.taxpayerId : record.payerId;
          const person = DEMO_USERS[counterpart];
          const status = record.status;
          return <li key={record.id} className="taxpay-auth-row" data-authorization-status={status}>
            <div className="taxpay-auth-person">
              <div>
                <h3>{bn ? person.nameBn : person.nameEn}</h3>
                <p>{person.id} · TIN <span className="taxpay-auth-tin">{person.tin}</span></p>
              </div>
              <span className={`taxpay-auth-status taxpay-auth-status--${status.toLowerCase()}`}>{statusLabel(status)}</span>
            </div>
            <p className="taxpay-auth-expiry"><Clock3 size={15} aria-hidden="true"/>{timeLabel(record)}</p>
            {tab === 'outgoing' && status === 'PENDING' &&
              <p className="taxpay-auth-note">{tr('Waiting for the taxpayer to accept. They will receive the four-digit code.', 'করদাতার সম্মতির অপেক্ষায়। তিনি চার সংখ্যার কোড পাবেন।')}</p>}
            {tab === 'incoming' && status === 'PENDING' && <div className="taxpay-auth-approval">
              <p>{tr('This person wants permission to pay your tax. Accept to receive your private code.', 'এই ব্যক্তি আপনার কর পরিশোধের অনুমতি চাইছেন। কোড পেতে গ্রহণ করুন।')}</p>
              <div className="taxpay-auth-inline">
                <button type="button" className="taxpay-auth-primary" disabled={busy} onClick={() => changeStatus(record, 'accept')}>{tr('Accept request', 'অনুরোধ গ্রহণ করুন')}</button>
                <button type="button" className="taxpay-auth-outline" disabled={busy} onClick={() => changeStatus(record, 'decline')}>{tr('Decline', 'প্রত্যাখ্যান')}</button>
              </div>
            </div>}
            {tab === 'incoming' && status === 'CODE_ISSUED' && <div className="taxpay-auth-approval">
              <p>{tr('Your four-digit confirmation code:', 'আপনার চার সংখ্যার নিশ্চিতকরণ কোড:')} <strong className="taxpay-auth-tin">{record.consentCode}</strong></p>
              {(record.codeResends??0)>0 && <p role="status">{tr('A new code was requested. Use this latest code; older codes are invalid.', 'নতুন কোড চাওয়া হয়েছে। সর্বশেষ কোডটি ব্যবহার করুন; আগেরগুলো কার্যকর নয়।')}</p>}
              <p>{tr('Share it with the requester. The code expires in 15 minutes.', 'অনুরোধকারীকে কোডটি দিন। ১৫ মিনিট পরে কোডের মেয়াদ শেষ হবে।')}</p>
              <button type="button" className="taxpay-auth-outline" disabled={busy} onClick={() => changeStatus(record, 'decline')}>{tr('Decline instead', 'পরিবর্তে প্রত্যাখ্যান করুন')}</button>
            </div>}
            {tab === 'outgoing' && status === 'CODE_ISSUED' && <div className="taxpay-auth-approval">
              <p>{tr('The taxpayer accepted. Enter the four-digit code they shared with you:', 'করদাতা গ্রহণ করেছেন। তাঁর দেওয়া চার সংখ্যার কোড লিখুন:')}</p>
              <div className="taxpay-auth-inline">
                <input aria-label={tr('Four-digit confirmation code', 'চার সংখ্যার নিশ্চিতকরণ কোড')} inputMode="numeric" autoComplete="one-time-code" maxLength={4}
                  value={codes[record.id]??''} onChange={e=>setCodes(old=>({...old,[record.id]:e.target.value.replace(/\D/g,'').slice(0,4)}))}
                  placeholder={tr('4-digit code','৪ সংখ্যার কোড')}/>
                <button type="button" className="taxpay-auth-primary" disabled={busy||(codes[record.id]??'').length!==4}
                  onClick={()=>confirmCode(record)}>{tr('Complete authorization','অনুমোদন সম্পূর্ণ করুন')}</button>
              </div>
              <div className="taxpay-auth-actions">
                <button type="button" className="taxpay-auth-outline" disabled={busy || (record.codeResends??0)>=3 || (record.codeSentAt!=null && now-record.codeSentAt<60000)}
                  onClick={() => resendCode(record)}><RefreshCw size={15} aria-hidden="true" />{tr('Resend code', 'কোড আবার পাঠান')}</button>
                {(record.codeResends??0)>=3 ? <p className="taxpay-auth-note">{tr('Resend limit reached (3). Start a new request if this one expires.', 'তিনবার কোড পাঠানোর সীমা শেষ। মেয়াদ শেষ হলে নতুন অনুরোধ করুন।')}</p>
                  : record.codeSentAt!=null && now-record.codeSentAt<60000 ? <p className="taxpay-auth-note">{tr(`Available in ${Math.ceil((60000-(now-record.codeSentAt))/1000)} seconds`, `${Math.ceil((60000-(now-record.codeSentAt))/1000)} সেকেন্ড পরে আবার পাঠাতে পারবেন`)}</p> : null}
              </div>
            </div>}
            {tab === 'incoming' && status === 'ACTIVE' && <div className="taxpay-auth-actions">
              {removeId !== record.id ? <button type="button" className="taxpay-auth-danger" onClick={() => setRemoveId(record.id)}>{tr('Remove authorization', 'অনুমোদন বাতিল করুন')}</button>
                : <div className="taxpay-auth-confirm">
                  <p>{tr('Remove this person’s permission to initiate further payments for you?', 'এই ব্যক্তির আপনার হয়ে নতুন পেমেন্ট শুরু করার অনুমতি বাতিল করবেন?')}</p>
                  <div className="taxpay-auth-inline taxpay-auth-confirm__actions">
                    <button type="button" className="taxpay-auth-outline" onClick={() => setRemoveId(null)}>{tr('Keep authorization', 'অনুমোদন রাখুন')}</button>
                    <button type="button" className="taxpay-auth-danger" onClick={() => changeStatus(record, 'revoke')}>{tr('Confirm removal', 'বাতিল নিশ্চিত করুন')}</button>
                  </div>
                </div>}
            </div>}
            <div className="taxpay-auth-actions">
              {deleteId !== record.id ? <button type="button" className="taxpay-auth-outline" disabled={busy}
                onClick={() => { setDeleteId(record.id); setRemoveId(null); }}><Trash2 size={15} aria-hidden="true" />{tr('Delete', 'মুছুন')}</button>
                : <div className="taxpay-auth-confirm">
                  <p>{status === 'ACTIVE' ? tr('Deleting will immediately revoke this payment permission for both people. The payment and audit history will remain.', 'মুছলে উভয়ের জন্য পরিশোধের অনুমতি বাতিল হবে। পেমেন্ট ও নিরীক্ষার ইতিহাস থাকবে।')
                    : status === 'PENDING' || status === 'CODE_ISSUED' ? tr('Deleting will cancel this pending request for both people and hide it from your list. The audit record will remain.', 'মুছলে অনুরোধটি উভয়ের জন্য বাতিল হবে এবং আপনার তালিকা থেকে সরে যাবে। নিরীক্ষার রেকর্ড থাকবে।')
                    : tr('Remove this item from your list? The audit history will remain available to Office.', 'তালিকা থেকে সরাবেন? নিরীক্ষার ইতিহাস অফিসে থাকবে।')}</p>
                  <div className="taxpay-auth-inline taxpay-auth-confirm__actions">
                    <button type="button" className="taxpay-auth-outline" disabled={busy} onClick={() => setDeleteId(null)}>{tr('Cancel', 'ফিরে যান')}</button>
                    <button type="button" className="taxpay-auth-danger" disabled={busy} onClick={() => deleteAuthorization(record)}>{tr('Confirm delete', 'মুছতে নিশ্চিত করুন')}</button>
                  </div>
                </div>}
            </div>
          </li>;
        })}
      </ul>}
    </section>}
  </section>;
}
