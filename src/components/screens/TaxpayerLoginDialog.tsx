import '../../styles/taxpay-service-choice.css';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { TaxPayModal } from '../ui/TaxPayModal';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerBrandName } from '../../config/brand';
import { DEMO_USER_IDS, DEMO_USERS, type DemoUserId } from '../../data/demoUsers';

/** TaxPay-only preview account entry. This does not authenticate API calls. */
/** One footer action for both standalone and in-journey sign-in modals. */
export function TaxpayerLoginFooter({ formId, disabled, language }: {
  formId: string;
  disabled: boolean;
  language: 'en' | 'bn';
}) {
  return <div className="tax-service-choice__actions taxpayer-login-actions">
    <button className="tax-service-choice__continue" type="submit" form={formId} disabled={disabled}>
      {language === 'bn' ? 'সাইন ইন' : 'Sign In'} <ArrowRight size={18} aria-hidden="true" />
    </button>
  </div>;
}

export function TaxpayerLoginDialog({ onClose, onSuccess, preservePaymentJourney = false, embedded = false, onValidityChange }: {
  onClose?: () => void;
  onSuccess?: () => void;
  preservePaymentJourney?: boolean;
  /** Reuse the parent payment modal's title, close control, overlay and footer. */
  embedded?: boolean;
  onValidityChange?: (valid: boolean) => void;
  /** Kept for existing callers; the approved login has no email prompt. */
  emailReturnTo?: string;
  verifiedOnly?: boolean;
} = {}) {
  const { language, loginPreviewAccount, navigate } = useTaxState();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<'invalid'|'already_signed_in'|'unavailable'|null>(null);
  const [signingIn,setSigningIn]=useState(false);
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
  const [highlighted,setHighlighted]=useState(0);
  const suggestions=DEMO_USER_IDS.filter(id=>{
    const query=userId.trim().toLowerCase();
    return id.includes(query)||DEMO_USERS[id].nameEn.toLowerCase().includes(query);
  });
  const choosePreview=(id:DemoUserId)=>{
    // Credentials here identify fictional public QA profiles only; never auto-fill real Auth credentials.
    setUserId(id);
    setPassword(id);
    setError(null);
    setSuggestionsOpen(false);
    setHighlighted(0);
    inputRef.current?.focus();
  };
  const onUserIdKeyDown=(event:React.KeyboardEvent<HTMLInputElement>)=>{
    if(event.key==='Escape'&&suggestionsOpen){
      // The parent modal also listens for Escape at document level. Dismiss the
      // account list first without ending the entire sign-in journey.
      event.preventDefault();event.stopPropagation();setSuggestionsOpen(false);return;
    }
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      setSuggestionsOpen(true);
      if(!suggestions.length)return;
      setHighlighted(current=>event.key==='ArrowDown'?(current+1)%suggestions.length:(current-1+suggestions.length)%suggestions.length);
      return;
    }
    if(event.key==='Enter'&&suggestionsOpen&&suggestions.length){
      event.preventDefault();
      choosePreview(suggestions[Math.min(highlighted,suggestions.length-1)]);
    }
  };
  const { user: verifiedApplicationUser } = useAccountIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLUListElement>(null);
  // Keep the active option visible during keyboard travel through 55 IDs.
  // Scroll the list itself, never the payment modal or the underlying page.
  useEffect(() => {
    if (!suggestionsOpen) return;
    const list = suggestionListRef.current;
    const option = list?.querySelectorAll<HTMLElement>('[role="option"]')[highlighted];
    if (!list || !option) return;
    const viewport = list.getBoundingClientRect();
    const active = option.getBoundingClientRect();
    if (active.top < viewport.top) list.scrollTop -= viewport.top - active.top;
    else if (active.bottom > viewport.bottom) list.scrollTop += active.bottom - viewport.bottom;
  }, [suggestionsOpen, highlighted, userId]);
  const bn = language === 'bn';
  const close = () => onClose ? onClose() : navigate('landing');
  const credentialsReady = Boolean(userId.trim() && password.trim());
  useEffect(() => { onValidityChange?.(credentialsReady); }, [credentialsReady, onValidityChange]);

  // The shared TaxPayModal owns Escape, focus containment, overlay and focus restoration.
  // Embedded login still focuses the first field when entered from the payment stepper.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!credentialsReady||signingIn) return;
    if (verifiedApplicationUser) {
      setError('already_signed_in');
      return;
    }
    setSigningIn(true);setError(null);
    try{
      const success=await loginPreviewAccount(userId,password,{preserveRoute:preservePaymentJourney});
      if(!success){setError('invalid');inputRef.current?.focus();}
      else onSuccess?.();
    }catch{
      setError('unavailable');
    }finally{setSigningIn(false);}
  };

  const title = bn ? `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন` : `Sign In To Your ${taxpayerBrandName(language)} Account`;
  const content = <section className="taxpayer-login-dialog taxpayer-login-dialog--embedded">
      <form id={embedded ? 'taxpay-embedded-login-form' : 'taxpay-standalone-login-form'} onSubmit={submit} noValidate>
        <div className="taxpayer-login-field">
          <label htmlFor="taxpayer-login-user-id">{bn ? 'ইউজার আইডি' : 'User ID'}</label>
          <div className="taxpayer-login-input-wrap">
            <UserRound size={18} aria-hidden="true" />
            <input ref={inputRef} id="taxpayer-login-user-id" type="text" autoComplete="username"
              aria-autocomplete="list" aria-haspopup="listbox"
              aria-expanded={suggestionsOpen} aria-controls="taxpayer-login-account-options"
              aria-activedescendant={suggestionsOpen&&suggestions.length ? `taxpayer-login-account-${suggestions[Math.min(highlighted,suggestions.length-1)]}`:undefined}
              autoCapitalize="none" spellCheck={false}
              placeholder={bn ? 'আপনার ইউজার আইডি লিখুন' : 'Enter your User ID'}
              aria-invalid={Boolean(error)}
              value={userId}
              onFocus={()=>{setHighlighted(0);setSuggestionsOpen(true);}}
              onBlur={()=>setSuggestionsOpen(false)}
              onKeyDown={onUserIdKeyDown}
              onChange={event => { setUserId(event.target.value);setPassword('');setHighlighted(0);setSuggestionsOpen(true);setError(null); }} />
          </div>
          {suggestionsOpen && <ul ref={suggestionListRef} id="taxpayer-login-account-options" className="taxpayer-login-suggestions" role="listbox" aria-label={bn?'পরীক্ষামূলক অ্যাকাউন্ট':'Test accounts'}>
              {suggestions.map((id,index)=><li id={`taxpayer-login-account-${id}`} key={id} role="option" aria-selected={index===highlighted}
                className={index===highlighted?'taxpayer-login-suggestion--active':undefined}
                onPointerDown={event=>{event.preventDefault();choosePreview(id);}}
                onClick={()=>choosePreview(id)}>
                <span>{id}</span><span>{bn?DEMO_USERS[id].nameBn:DEMO_USERS[id].nameEn}</span>
              </li>)}
              {!suggestions.length&&<li role="presentation" className="taxpayer-login-suggestions__empty">{bn?'কোনো পরীক্ষামূলক অ্যাকাউন্ট পাওয়া যায়নি':'No test accounts found'}</li>}
            </ul>}
        </div>
        <div className="taxpayer-login-field">
          <label htmlFor="taxpayer-login-password">{bn ? 'পাসওয়ার্ড' : 'Password'}</label>
          <div className="taxpayer-login-input-wrap taxpayer-login-password-wrap">
            <LockKeyhole size={18} aria-hidden="true" />
            <input id="taxpayer-login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              placeholder={bn ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter your password'}
              aria-invalid={Boolean(error)}
              value={password} onChange={event => { setPassword(event.target.value); setError(null); }} />
            <button type="button" className="taxpayer-login-password-toggle"
              onClick={() => setShowPassword(visible => !visible)}
              aria-label={showPassword ? (bn ? 'পাসওয়ার্ড আড়াল করুন' : 'Hide password') : (bn ? 'পাসওয়ার্ড দেখুন' : 'Show password')}
              aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
            </button>
          </div>
        </div>
        <div className="taxpayer-login-recovery-row">
          <p>{bn ? 'আপনার তথ্য ভুলে গেছেন?' : 'Forgot your details?'}</p>
          <button type="button" aria-expanded={showRecovery} aria-controls="taxpayer-login-recovery"
            onClick={() => setShowRecovery(open => !open)}>{bn ? 'অ্যাকাউন্ট পুনরুদ্ধার' : 'Recover Account'}</button>
        </div>
        {showRecovery && <p id="taxpayer-login-recovery" className="taxpayer-login-recovery" role="status">
          {bn ? 'বর্তমান user1–user55 অ্যাকাউন্টের পাসওয়ার্ড তার ইউজার আইডির সমান।' : 'For the current user1–user55 accounts, the password is the same as the User ID.'}
        </p>}
        {error && <p className="taxpayer-login-error" role="alert">
          {error === 'already_signed_in'
            ? (bn ? 'আগে বর্তমান অ্যাকাউন্ট থেকে সাইন আউট করুন।' : 'Sign out of the current account before switching users.')
            : error === 'unavailable'
              ? (bn ? 'আপনার প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।' : 'Could not load your saved profile. Please retry.')
              : (bn ? 'ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়।' : 'Incorrect User ID or password.')}
        </p>}
      </form>
    </section>;
  if (embedded) return content;
  return <TaxPayModal
    title={title}
    onClose={close}
    onBack={close}
    backLabel={bn ? 'ফিরুন' : 'Back'}
    closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
    className="taxpayer-login-modal"
    service="login"
    initialFocusSelector="#taxpayer-login-user-id"
    footer={<TaxpayerLoginFooter formId="taxpay-standalone-login-form" disabled={!credentialsReady||signingIn} language={language} />}
  >
    {content}
  </TaxPayModal>;
}
