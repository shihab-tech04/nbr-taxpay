import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, CircleUserRound, LogOut, RefreshCcw, Settings2, ShieldAlert } from 'lucide-react';
import { supabase, backendConfigured } from '../../services/supabaseClient';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';
import { useTaxState } from '../../services/taxState';

export type AccountPage = 'profile' | 'settings' | 'notifications';
type DraftNotice = { id: string; owner_uid: string; created_at: string; category: string; assessment_year: string };
type ReviewNotice = { id: string; request_id: string; message_code: string; is_read: boolean; created_at: string };

const I18N = {
  en: {
    profile: 'Profile', settings: 'Profile settings', notifications: 'Notifications',
    intro: 'Application account · e-TIN not linked',
    guest: 'Sign in to view your account.',
    demo: 'Profile', demoNotice: 'Account details',
    unavailable: 'Sign-in is currently unavailable.',
    email: 'Account email', name: 'Display name', joined: 'Account created', verified: 'Email confirmed', noName: 'Not set',
    unverified: 'Not confirmed', accountId: 'Application account ID', save: 'Save preferences', saving: 'Saving…',
    preferences: 'Preferences', language: 'Interface language', alertsEnabled: 'Show my in-app draft notifications',
    alertsHelp: 'In-app notifications only.',
    notificationsTitle: 'Account notifications', noticesInfo: 'Your private draft activity and officer review updates. Review actions do not confirm a payment.',
    reviewTitle: 'Officer review updates', reviewLabel: 'Non-financial review',
    reviewReceived: 'Review request submitted', reviewAcknowledged: 'Officer acknowledged your request',
    reviewInfo: 'Officer requested additional information', reviewClosed: 'Officer completed the review',
    noNotices: 'No stored draft activity for this account.', noDemoNotices: 'No notifications yet.',
    load: 'Loading private activity…', loadError: 'Could not load notifications. Try again.',
    retry: 'Retry', markRead: 'Mark all as viewed', viewed: 'Viewed', new: 'New', draft: 'Draft saved',
    draftCaption: 'No payment made.', settingsSaved: 'Preferences saved to your application account.',
    readSaved: 'Notification viewing status saved to your account.', saveFailed: 'Could not save. Please retry.',
    logout: 'Sign out', logoutFailed: 'Sign-out failed. Your account may still be signed in.',
    loggedOut: 'Signed out of this browser session.', accountAccess: 'Account sign-in', exitDemo: 'Exit demo',
    english: 'English', bangla: 'বাংলা', off: 'In-app notifications are turned off in this account. You can enable them under Profile settings.',
    consent: 'Changes apply to this account only.'
  },
  bn: {
    profile: 'প্রোফাইল', settings: 'প্রোফাইল সেটিংস', notifications: 'বিজ্ঞপ্তি',
    intro: 'অ্যাপ অ্যাকাউন্ট · ই-টিআইএন সংযুক্ত নয়',
    guest: 'অ্যাকাউন্ট দেখতে সাইন ইন করুন।',
    demo: 'প্রোফাইল', demoNotice: 'অ্যাকাউন্টের বিবরণ',
    unavailable: 'সাইন ইন আপাতত চালু নেই।',
    email: 'অ্যাকাউন্ট ইমেইল', name: 'প্রদর্শিত নাম', joined: 'অ্যাকাউন্ট তৈরির তারিখ', verified: 'ইমেইল নিশ্চিতকরণ', noName: 'দেওয়া হয়নি',
    unverified: 'নিশ্চিত হয়নি', accountId: 'অ্যাপ অ্যাকাউন্ট আইডি', save: 'পছন্দ সংরক্ষণ', saving: 'সংরক্ষণ হচ্ছে…',
    preferences: 'পছন্দসমূহ', language: 'ইন্টারফেসের ভাষা', alertsEnabled: 'আমার ড্রাফটের ইন-অ্যাপ বিজ্ঞপ্তি দেখান',
    alertsHelp: 'শুধু অ্যাপের বিজ্ঞপ্তি।',
    notificationsTitle: 'অ্যাকাউন্টের বিজ্ঞপ্তি', noticesInfo: 'আপনার ব্যক্তিগত খসড়া ও কর্মকর্তার পর্যালোচনার খবর। পর্যালোচনা মানে অর্থ পরিশোধ নিশ্চিত হওয়া নয়।',
    reviewTitle: 'কর্মকর্তার পর্যালোচনার হালনাগাদ', reviewLabel: 'অ-আর্থিক পর্যালোচনা',
    reviewReceived: 'রিভিউ অনুরোধ জমা হয়েছে', reviewAcknowledged: 'কর্মকর্তা অনুরোধ গ্রহণ করেছেন',
    reviewInfo: 'কর্মকর্তা অতিরিক্ত তথ্য চেয়েছেন', reviewClosed: 'কর্মকর্তা পর্যালোচনা শেষ করেছেন',
    noNotices: 'এই অ্যাকাউন্টে সংরক্ষিত ড্রাফটের কার্যক্রম নেই।', noDemoNotices: 'এখনো কোনো বিজ্ঞপ্তি নেই।',
    load: 'ব্যক্তিগত কার্যক্রম লোড হচ্ছে…', loadError: 'বিজ্ঞপ্তি লোড করা যায়নি। আবার চেষ্টা করুন।',
    retry: 'আবার চেষ্টা', markRead: 'সবগুলো দেখা হয়েছে', viewed: 'দেখা', new: 'নতুন', draft: 'খসড়া সংরক্ষিত',
    draftCaption: 'কোনো পেমেন্ট হয়নি।', settingsSaved: 'অ্যাপ অ্যাকাউন্টে পছন্দ সংরক্ষিত হয়েছে।',
    readSaved: 'অ্যাকাউন্টে বিজ্ঞপ্তি দেখার অবস্থা সংরক্ষিত হয়েছে।', saveFailed: 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।',
    logout: 'সাইন আউট', logoutFailed: 'সাইন আউট ব্যর্থ। অ্যাকাউন্ট এখনো খোলা থাকতে পারে।',
    loggedOut: 'এই ব্রাউজার থেকে সাইন আউট হয়েছে।', accountAccess: 'অ্যাকাউন্টে প্রবেশ', exitDemo: 'ডেমো থেকে বের হোন',
    english: 'English', bangla: 'বাংলা', off: 'এই অ্যাকাউন্টে ইন-অ্যাপ বিজ্ঞপ্তি বন্ধ। প্রোফাইল সেটিংস থেকে চালু করতে পারবেন।',
    consent: 'পরিবর্তন শুধু এই অ্যাকাউন্টের জন্য।'
  }
} as const;

export function AccountCenter({ page }: { page: AccountPage }) {
  const { language, setLanguage, navigate, userRole, setUserRole, taxpayerProfile } = useTaxState();
  const { user, loading } = useAccountIdentity();
  const t = I18N[language];
  const sample = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'].includes(userRole);
  const [name, setName] = useState('');
  const [showNotifications, setShowNotifications] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState<'en'|'bn'>(language);
  const [notices, setNotices] = useState<DraftNotice[]>([]);
  const [reviewNotices, setReviewNotices] = useState<ReviewNotice[]>([]);
  const [loadState, setLoadState] = useState<'idle'|'loading'|'error'|'ready'>('idle');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; content: string } | null>(null);
  const title = page === 'profile' ? t.profile : page === 'settings' ? t.settings : t.notifications;
  const allowed = user?.user_metadata?.taxpay_in_app_notifications !== false;
  const readAt = typeof user?.user_metadata?.taxpay_notifications_read_at === 'string'
    ? Date.parse(user.user_metadata.taxpay_notifications_read_at) : NaN;

  useEffect(() => {
    setName(typeof user?.user_metadata?.taxpay_display_name === 'string'
      ? user.user_metadata.taxpay_display_name : '');
    setShowNotifications(user?.user_metadata?.taxpay_in_app_notifications !== false);
    const storedLanguage = user?.user_metadata?.taxpay_language;
    setPreferredLanguage(storedLanguage === 'bn' || storedLanguage === 'en' ? storedLanguage : language);
    setFeedback(null);
  }, [user?.id]);

  useEffect(() => {
    if (page !== 'notifications' || !user || !allowed) {
      setNotices([]);
      setReviewNotices([]);
      setLoadState('idle');
      return;
    }
    const client = supabase;
    if (!client) return;
    let active = true;
    const uid = user.id;
    setLoadState('loading');
    (async () => {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || auth.user?.id !== uid) throw new Error('Account session expired');
      const [draftResult, reviewResult] = await Promise.all([
        client.from('taxpay_payment_drafts').select('id,owner_uid,created_at,category,assessment_year')
          .eq('owner_uid', uid).order('created_at', { ascending: false }).limit(30),
        client.from('taxpay_in_app_notifications').select('id,request_id,message_code,is_read,created_at')
          .order('created_at', { ascending: false }).limit(50)
      ]);
      if (draftResult.error || reviewResult.error) throw draftResult.error ?? reviewResult.error;
      const { data: stillCurrent, error: rereadError } = await client.auth.getUser();
      if (rereadError || stillCurrent.user?.id !== uid) throw new Error('Account session changed');
      if (!active) return;
      setNotices((draftResult.data ?? []).filter((item: DraftNotice) => item.owner_uid === uid));
      setReviewNotices((reviewResult.data ?? []) as ReviewNotice[]);
      setLoadState('ready');
    })().catch(() => { if (active) { setNotices([]); setReviewNotices([]); setLoadState('error'); } });
    return () => { active = false; };
  }, [page, user?.id, allowed, revision]);

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !supabase) return;
    if (name.trim().length > 80) { setFeedback({error:true,content:t.saveFailed}); return; }
    setBusy(true); setFeedback(null);
    try {
      const { data: current, error: identityError } = await supabase.auth.getUser();
      if (identityError || current.user?.id !== user.id) throw new Error('Session changed');
      const { error } = await supabase.auth.updateUser({ data: {
        ...current.user.user_metadata,
        taxpay_display_name: name.trim(),
        taxpay_in_app_notifications: showNotifications,
        taxpay_language: preferredLanguage
      }});
      if (error) throw error;
      setLanguage(preferredLanguage);
      setFeedback({error:false,content:I18N[preferredLanguage].settingsSaved});
    } catch { setFeedback({error:true,content:t.saveFailed}); }
    finally { setBusy(false); }
  };

  const markViewed = async () => {
    if (!user || !supabase || loadState !== 'ready') return;
    setBusy(true); setFeedback(null);
    try {
      const { data: current, error: identityError } = await supabase.auth.getUser();
      if (identityError || current.user?.id !== user.id) throw new Error('Session changed');
      const { error } = await supabase.auth.updateUser({ data: {
        ...current.user.user_metadata, taxpay_notifications_read_at: new Date().toISOString()
      }});
      if (error) throw error;
      const unread = reviewNotices.filter(n=>!n.is_read).map(n=>n.id);
      if (unread.length) {
        const { data: updated, error: reviewError } = await supabase.from('taxpay_in_app_notifications')
          .update({is_read:true}).in('id',unread).select('id');
        if (reviewError || updated?.length !== unread.length) throw new Error('Review notice read-back not confirmed');
        setReviewNotices(prev=>prev.map(n=>unread.includes(n.id)?{...n,is_read:true}:n));
      }
      setFeedback({error:false,content:t.readSaved});
    } catch { setFeedback({error:true,content:t.saveFailed}); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    setBusy(true); setFeedback(null);
    try {
      const result = await signOutApplicationAccount();
      if (!result.ok) throw new Error(result.error);
      setNotices([]); setReviewNotices([]); setUserRole('GUEST'); setFeedback({error:false,content:t.loggedOut});
      navigate('landing');
    } catch { setFeedback({error:true,content:t.logoutFailed}); }
    finally { setBusy(false); }
  };

  const date = (value?: string | null) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-GB', {day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
  };
  const sampleOnly = !user && sample;
  return (
    <section className="taxpayer-account-center" lang={language} aria-labelledby="taxpay-account-title">
      <header className="taxpayer-account-heading">
        <h1 id="taxpay-account-title">{title}</h1>
        <p>{t.intro}</p>
      </header>
      <nav className="taxpayer-account-tabs" aria-label={language === 'bn' ? 'অ্যাকাউন্ট পৃষ্ঠা' : 'Account pages'}>
        {(['profile','notifications','settings'] as const).map(route => (
          <button type="button" key={route} aria-current={page === route ? 'page' : undefined}
            onClick={() => navigate('account_' + route)}>
            {route === 'profile' ? <CircleUserRound size={17} aria-hidden /> :
              route === 'notifications' ? <Bell size={17} aria-hidden /> : <Settings2 size={17} aria-hidden />}
            {route === 'profile' ? t.profile : route === 'notifications' ? t.notifications : t.settings}
          </button>
        ))}
      </nav>
      {loading ? <p role="status" className="taxpayer-account-panel">{language === 'bn' ? 'অ্যাকাউন্ট যাচাই হচ্ছে…' : 'Checking account…'}</p>
        : !user ? (
          <section className="taxpayer-account-panel">
            <h2>{sampleOnly ? t.demo : t.accountAccess}</h2>
            <p>{sampleOnly ? t.demoNotice : !backendConfigured ? t.unavailable : t.guest}</p>
            {sampleOnly && page === 'profile' && (
              <dl className="taxpayer-account-facts">
                <div><dt>{t.name}</dt><dd>{language === 'bn' ? taxpayerProfile.nameBn : taxpayerProfile.nameEn}</dd></div>
                <div><dt>{language === 'bn' ? 'অ্যাকাউন্টের ধরন' : 'Account type'}</dt><dd>{taxpayerProfile.type}</dd></div>
              </dl>
            )}
            {sampleOnly && page === 'settings' && (
              <div className="taxpayer-account-fields">
                <label htmlFor="taxpay-demo-language">{t.language}</label>
                <select id="taxpay-demo-language" value={language} onChange={e => setLanguage(e.target.value as 'en'|'bn')}>
                  <option value="en">{t.english}</option><option value="bn">{t.bangla}</option>
                </select>
                <p>{t.consent}</p>
              </div>
            )}
            {page === 'notifications' && <p role="status">{t.noDemoNotices}</p>}
            <div className="taxpayer-account-actions">
              <button type="button" onClick={() => navigate('secure_workspace')}>{t.accountAccess}</button>
              {sampleOnly && <button type="button" className="taxpayer-account-secondary" onClick={() => {
                setUserRole('GUEST'); navigate('landing');
              }}>{t.exitDemo}</button>}
            </div>
          </section>
        ) : (
          <>
            {page === 'profile' && (
              <section className="taxpayer-account-panel">
                <h2>{t.profile}</h2>
                <dl className="taxpayer-account-facts">
                  <div><dt>{t.name}</dt><dd>{typeof user.user_metadata?.taxpay_display_name === 'string' && user.user_metadata.taxpay_display_name.trim() ? user.user_metadata.taxpay_display_name : t.noName}</dd></div>
                  <div><dt>{t.email}</dt><dd>{user.email ?? '—'}</dd></div>
                  <div><dt>{t.verified}</dt><dd>{user.email_confirmed_at ? date(user.email_confirmed_at) : t.unverified}</dd></div>
                  <div><dt>{t.joined}</dt><dd>{date(user.created_at)}</dd></div>
                  <div><dt>{t.accountId}</dt><dd className="taxpayer-account-id">{user.id}</dd></div>
                </dl>
                <p className="taxpayer-account-notice"><ShieldAlert size={17} aria-hidden />{t.consent}</p>
              </section>
            )}
            {page === 'settings' && (
              <form className="taxpayer-account-panel taxpayer-account-fields" onSubmit={savePreferences}>
                <h2>{t.preferences}</h2>
                <label htmlFor="taxpay-profile-display-name">{t.name}</label>
                <input id="taxpay-profile-display-name" maxLength={80} autoComplete="nickname"
                  value={name} onChange={e => setName(e.target.value)} />
                <label htmlFor="taxpay-profile-language">{t.language}</label>
                <select id="taxpay-profile-language" value={preferredLanguage}
                  onChange={e => setPreferredLanguage(e.target.value as 'en'|'bn')}>
                  <option value="en">{t.english}</option><option value="bn">{t.bangla}</option>
                </select>
                <label className="taxpayer-account-toggle">
                  <input type="checkbox" checked={showNotifications} onChange={e=>setShowNotifications(e.target.checked)}/>
                  <span>{t.alertsEnabled}</span>
                </label>
                <p>{t.alertsHelp}</p>
                <p>{t.consent}</p>
                <button type="submit" disabled={busy}>{busy ? t.saving : t.save}</button>
              </form>
            )}
            {page === 'notifications' && (
              <section className="taxpayer-account-panel">
                <h2>{t.notificationsTitle}</h2>
                <p>{t.noticesInfo}</p>
                {!allowed ? <p role="status">{t.off}</p> : loadState === 'loading' ? <p role="status">{t.load}</p>
                  : loadState === 'error' ? <div><p role="alert">{t.loadError}</p>
                      <button type="button" onClick={()=>setRevision(n=>n+1)}>{t.retry} <RefreshCcw size={16} aria-hidden /></button></div>
                  : loadState === 'ready' && (notices.length || reviewNotices.length) ? <>
                     {reviewNotices.length > 0 && <section>
                       <h3>{t.reviewTitle}</h3>
                       <ul className="taxpayer-account-notices">
                         {reviewNotices.map(item => {
                           const codes:Record<string,string>={
                             REQUEST_SUBMITTED:t.reviewReceived,
                             REQUEST_ACKNOWLEDGED:t.reviewAcknowledged,
                             REQUEST_INFO_REQUESTED:t.reviewInfo,
                             REQUEST_REVIEW_CLOSED:t.reviewClosed
                           };
                           return <li key={item.id}>
                             <div><strong>{codes[item.message_code] ?? t.reviewLabel}</strong><span>{item.is_read?t.viewed:t.new}</span></div>
                             <p>{item.request_id} · {date(item.created_at)}</p>
                             <p>{t.draftCaption}</p>
                           </li>;
                         })}
                       </ul>
                     </section>}
                    <button type="button" className="taxpayer-account-secondary" disabled={busy} onClick={markViewed}>
                      <CheckCheck size={17} aria-hidden />{t.markRead}
                    </button>
                    <ul className="taxpayer-account-notices">
                      {notices.map(item => {
                        const isNew = !Number.isFinite(readAt) || Date.parse(item.created_at) > readAt;
                        return <li key={item.id}>
                          <div><strong>{t.draft}</strong><span>{isNew ? t.new : t.viewed}</span></div>
                          <p>{item.assessment_year} · {item.category} · {date(item.created_at)}</p>
                          <p>{t.draftCaption}</p>
                        </li>;
                      })}
                    </ul>
                  </> : <p role="status">{t.noNotices}</p>}
              </section>
            )}
            <div className="taxpayer-account-actions">
              <button type="button" className="taxpayer-account-secondary" disabled={busy} onClick={signOut}>
                <LogOut size={17} aria-hidden />{t.logout}
              </button>
            </div>
          </>
        )}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className="taxpayer-account-feedback">{feedback.content}</p>}
    </section>
  );
}
