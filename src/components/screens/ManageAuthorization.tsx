import React, { useEffect, useState } from 'react';
import { Clock3, Plus, ShieldCheck, ShieldX, UsersRound, X } from 'lucide-react';
import { DEMO_USERS, type DemoUserId } from '../../data/demoUsers';
import { sampleJourneysEnabled, useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import {
  approveDemoAuthorization, declineDemoAuthorization, effectiveAuthorizationStatus,
  generateDemoOtp, loadDemoAuthorizations, requestDemoAuthorization,
  revokeDemoAuthorization, saveDemoAuthorizations, subscribeDemoAuthorizations,
  userIdForDemoTin, type DemoAuthorization,
} from '../../services/demoAuthorizations';

type Tab = 'outgoing' | 'incoming';

export function ManageAuthorization() {
  const { language, previewAccount, demoUser, navigate } = useTaxState();
  const { user: applicationUser } = useAccountIdentity();
  const bn = language === 'bn';
  const tr = (en: string, bengali: string) => bn ? bengali : en;
  const actor = previewAccount?.id ?? (sampleJourneysEnabled ? demoUser?.id : undefined);
  const [tab, setTab] = useState<Tab>('outgoing');
  const [records, setRecords] = useState<DemoAuthorization[]>(loadDemoAuthorizations);
  const [now, setNow] = useState(Date.now());
  const [adding, setAdding] = useState(false);
  const [tin, setTin] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  useEffect(() => subscribeDemoAuthorizations(() => { setRecords(loadDemoAuthorizations()); setNow(Date.now()); }), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setFeedback(null); setAdding(false); setTin(''); setCodes({}); setRemoveId(null); }, [actor]);

  const sendRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!actor) return;
    const target = userIdForDemoTin(tin);
    if (!/^\d{13}$/.test(tin.trim())) {
      setFeedback({ error: true, message: tr('Enter a 13-digit test taxpayer TIN.', 'করদাতার ১৩ সংখ্যার পরীক্ষামূলক টিআইএন লিখুন।') });
      return;
    }
    if (!target) {
      setFeedback({ error: true, message: tr('No test taxpayer matches this TIN.', 'এই টিআইএন-এ কোনো পরীক্ষামূলক করদাতা নেই।') });
      return;
    }
    try {
      const next = requestDemoAuthorization(loadDemoAuthorizations(), actor, target, generateDemoOtp());
      saveDemoAuthorizations(next);
      setTin(''); setAdding(false);
      setFeedback({ error: false, message: tr('Request created. The taxpayer can approve it from their own account.', 'অনুরোধ তৈরি হয়েছে। করদাতা নিজ অ্যাকাউন্ট থেকে অনুমোদন করতে পারবেন।') });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : tr('Could not create request.', 'অনুরোধ তৈরি করা যায়নি।') });
    }
  };
  const confirmCode = (record: DemoAuthorization) => {
    if (!actor) return;
    try {
      const next = approveDemoAuthorization(loadDemoAuthorizations(), actor, record.id, codes[record.id] ?? '');
      saveDemoAuthorizations(next);
      setCodes(before => ({ ...before, [record.id]: '' }));
      const approved = next.find(r => r.id === record.id)?.status === 'ACTIVE';
      setFeedback({ error: !approved, message: approved
        ? tr('Authorization granted for 15 minutes.', '১৫ মিনিটের জন্য অনুমোদন দেওয়া হয়েছে।')
        : tr('Incorrect code. Three unsuccessful attempts decline the request.', 'ভুল কোড। তিনবার ভুল হলে অনুরোধ বাতিল হবে।') });
    } catch (error) { setFeedback({ error: true, message: error instanceof Error ? error.message : 'Verification failed.' }); }
  };
  const changeStatus = (record: DemoAuthorization, operation: 'revoke' | 'decline') => {
    if (!actor) return;
    try {
      const next = operation === 'revoke'
        ? revokeDemoAuthorization(loadDemoAuthorizations(), actor, record.id)
        : declineDemoAuthorization(loadDemoAuthorizations(), actor, record.id);
      saveDemoAuthorizations(next);
      setRemoveId(null);
      setFeedback({ error: false, message: operation === 'revoke'
        ? tr('Authorization removed.', 'অনুমোদন বাতিল করা হয়েছে।')
        : tr('Request declined.', 'অনুরোধ প্রত্যাখ্যান করা হয়েছে।') });
    } catch (error) { setFeedback({ error: true, message: error instanceof Error ? error.message : 'Action failed.' }); }
  };
  const statusLabel = (status: ReturnType<typeof effectiveAuthorizationStatus>) => ({
    ACTIVE: tr('Active', 'সক্রিয়'), PENDING: tr('Pending', 'অপেক্ষমাণ'), EXPIRED: tr('Expired', 'মেয়াদোত্তীর্ণ'),
    REVOKED: tr('Revoked', 'বাতিল'), DENIED: tr('Declined', 'প্রত্যাখ্যাত'),
  })[status];
  const timeLabel = (record: DemoAuthorization) => {
    const status = effectiveAuthorizationStatus(record, now);
    if (status === 'PENDING') return tr('Waiting for taxpayer consent', 'করদাতার সম্মতির অপেক্ষায়');
    if (status === 'ACTIVE') {
      const minutes = Math.max(1, Math.ceil(((record.activeUntil ?? now) - now) / 60000));
      return tr(`${minutes} minute${minutes === 1 ? '' : 's'} remaining`, `আর ${minutes} মিনিট`);
    }
    if (status === 'REVOKED') return tr('Access removed', 'অনুমতি বাতিল করা হয়েছে');
    if (status === 'DENIED') return tr('Request declined', 'অনুরোধ প্রত্যাখ্যাত');
    return tr('Authorization expired', 'অনুমোদনের মেয়াদ শেষ');
  };
  const shown = records.filter(record => actor && (tab === 'outgoing' ? record.payerId === actor : record.taxpayerId === actor));

  return <section className="taxpayer-account-center taxpay-authorization" lang={language} aria-labelledby="manage-auth-title" data-testid="manage-authorization">
    <header className="taxpayer-account-heading">
      <h1 id="manage-auth-title">{tr('Manage Authorization', 'অনুমোদন পরিচালনা')}</h1>
      <p>{tr('Choose who may facilitate income-tax payments for whom.', 'কে কার হয়ে আয়কর পরিশোধে সহায়তা করতে পারবেন, তা পরিচালনা করুন।')}</p>
    </header>
    <nav className="taxpayer-account-tabs" aria-label={tr('Authorization direction', 'অনুমোদনের ধরন')}>
      <button type="button" aria-current={tab === 'outgoing' ? 'page' : undefined} onClick={() => { setTab('outgoing'); setFeedback(null); setAdding(false); }}>
        <UsersRound size={17} aria-hidden="true"/>{tr('I can pay for', 'আমি যাঁদের জন্য দিতে পারি')}
      </button>
      <button type="button" aria-current={tab === 'incoming' ? 'page' : undefined} onClick={() => { setTab('incoming'); setFeedback(null); setRemoveId(null); }}>
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

      {adding && tab === 'outgoing' && <form className="taxpay-auth-add" onSubmit={sendRequest}>
        <label htmlFor="new-auth-tin">{tr('Taxpayer TIN', 'করদাতার টিআইএন')}</label>
        <div className="taxpay-auth-inline">
          <input id="new-auth-tin" value={tin} onChange={e => setTin(e.target.value.replace(/\D/g, '').slice(0, 13))}
            inputMode="numeric" autoComplete="off" placeholder={tr('Enter 13-digit test TIN', '১৩ সংখ্যার পরীক্ষামূলক টিআইএন লিখুন')} required maxLength={13} />
          <button type="submit" className="taxpay-auth-primary">{tr('Request authorization', 'অনুমোদন চান')}</button>
        </div>
        <p>{tr('The taxpayer approves from their own account using a one-time code.', 'করদাতা নিজের অ্যাকাউন্টে এককালীন কোড দিয়ে সম্মতি দেবেন।')}</p>
      </form>}

      {feedback && <p className={`taxpay-auth-feedback ${feedback.error ? 'taxpay-auth-feedback--error' : ''}`} role="status">{feedback.message}</p>}
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
          const status = effectiveAuthorizationStatus(record, now);
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
              <p className="taxpay-auth-note">{tr('The other taxpayer must enter the code in their own account. You cannot approve this request.', 'অন্য করদাতাকে নিজের অ্যাকাউন্টে কোড লিখতে হবে। আপনি নিজে অনুমোদন দিতে পারবেন না।')}</p>}
            {tab === 'incoming' && status === 'PENDING' && <div className="taxpay-auth-approval">
              <p>{tr('One-time code for your test account:', 'আপনার টেস্ট অ্যাকাউন্টের এককালীন কোড:')} <strong className="taxpay-auth-tin">{record.consentCode}</strong></p>
              <div className="taxpay-auth-inline">
                <input aria-label={tr('Enter one-time code', 'এককালীন কোড লিখুন')} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={codes[record.id] ?? ''} onChange={e => setCodes(old => ({ ...old, [record.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder={tr('6-digit code', '৬ সংখ্যার কোড')} />
                <button type="button" className="taxpay-auth-primary" onClick={() => confirmCode(record)} disabled={(codes[record.id] ?? '').length !== 6}>{tr('Authorize', 'অনুমোদন দিন')}</button>
                <button type="button" className="taxpay-auth-outline" onClick={() => changeStatus(record, 'decline')}>{tr('Decline', 'প্রত্যাখ্যান')}</button>
              </div>
            </div>}
            {tab === 'incoming' && status === 'ACTIVE' && <div className="taxpay-auth-actions">
              {removeId !== record.id ? <button type="button" className="taxpay-auth-danger" onClick={() => setRemoveId(record.id)}>{tr('Remove authorization', 'অনুমোদন বাতিল করুন')}</button>
                : <div className="taxpay-auth-confirm">
                  <p>{tr('Remove this person’s permission to initiate further payments for you?', 'এই ব্যক্তির আপনার হয়ে নতুন পেমেন্ট শুরু করার অনুমতি বাতিল করবেন?')}</p>
                  <div className="taxpay-auth-inline">
                    <button type="button" className="taxpay-auth-danger" onClick={() => changeStatus(record, 'revoke')}>{tr('Confirm removal', 'বাতিল নিশ্চিত করুন')}</button>
                    <button type="button" className="taxpay-auth-outline" onClick={() => setRemoveId(null)}>{tr('Keep authorization', 'অনুমোদন রাখুন')}</button>
                  </div>
                </div>}
            </div>}
          </li>;
        })}
      </ul>}
    </section>}
  </section>;
}
