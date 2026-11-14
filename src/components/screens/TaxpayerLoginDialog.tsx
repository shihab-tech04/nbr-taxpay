import '../../styles/taxpay-service-choice.css';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { TaxPayModal } from '../ui/TaxPayModal';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerBrandName } from '../../config/brand';
import { getDemoUser } from '../../data/demoUsers';

type DemoLoginStep = 'credentials'|'otp'|'success';
const demoOtpKey=(profileId:string)=>`korbritto.demo-login-otp.v1:${profileId}`;
function demoOtpAlreadyEntered(profileId:string):boolean {
  try{return window.localStorage.getItem(demoOtpKey(profileId))==='complete';}
  catch{return false;}
}
function rememberDemoOtp(profileId:string):void {
  try{window.localStorage.setItem(demoOtpKey(profileId),'complete');}
  catch{/* A private browser may ask for the demo code again on its next visit. */}
}

/** TaxPay-only preview account entry. This does not authenticate API calls. */
/** One footer action for both standalone and in-journey sign-in modals. */
export function TaxpayerLoginFooter({ formId, disabled, language }: {
  formId: string;
  disabled: boolean;
  language: 'en' | 'bn';
}) {
  const [step,setStep]=useState<DemoLoginStep>('credentials');
  useEffect(()=>{
    const form=document.getElementById(formId);
    if(!form)return;
    const sync=()=>{
      const value=form.getAttribute('data-demo-login-step');
      if(value==='credentials'||value==='otp'||value==='success')setStep(value);
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(form,{attributes:true,attributeFilter:['data-demo-login-step']});
    return()=>observer.disconnect();
  },[formId]);
  const label=step==='otp'
    ?(language==='bn'?'কোড যাচাই করুন':'Verify code')
    :step==='success'
      ?(language==='bn'?'সাইন ইন হচ্ছে…':'Signing in…')
      :(language==='bn'?'সাইন ইন':'Sign In');
  return <div className="tax-service-choice__actions taxpayer-login-actions">
    <button data-testid="taxpayer-login-submit" className="tax-service-choice__continue" type="submit" form={formId} disabled={disabled}>
      {label} <ArrowRight size={18} aria-hidden="true" />
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
  const [otpCode,setOtpCode]=useState('');
  const [step,setStep]=useState<DemoLoginStep>('credentials');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<'invalid'|'invalid_otp'|'already_signed_in'|'unavailable'|null>(null);
  const [signingIn,setSigningIn]=useState(false);
  const { user: verifiedApplicationUser } = useAccountIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const otpRef=useRef<HTMLInputElement>(null);
  const transitionTimer=useRef<number|null>(null);
  const bn = language === 'bn';
  const close = () => onClose ? onClose() : navigate('landing');
  const credentialsReady = Boolean(userId.trim() && password.trim());
  const canSubmit=step==='credentials'?credentialsReady:step==='otp'?credentialsReady&&/^\d{6}$/.test(otpCode):false;
  useEffect(() => { onValidityChange?.(canSubmit); }, [canSubmit, onValidityChange]);

  // The shared TaxPayModal owns Escape, focus containment, overlay and focus restoration.
  // Embedded login still focuses the first field when entered from the payment stepper.
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if(step==='otp')otpRef.current?.focus(); }, [step]);
  useEffect(()=>()=>{if(transitionTimer.current!==null)window.clearTimeout(transitionTimer.current);},[]);

  const finishDemoSignIn=async(usedOtp:boolean)=>{
    setSigningIn(true);setError(null);
    try{
      // This creates only the existing fictional preview capability. It never
      // calls Supabase Auth or authenticates a production taxpayer account.
      const success=await loginPreviewAccount(userId.trim().toLowerCase(),password,{preserveRoute:true});
      if(!success){setStep('credentials');setError('invalid');inputRef.current?.focus();return;}
      if(usedOtp)rememberDemoOtp(userId.trim().toLowerCase());
      setStep('success');
      transitionTimer.current=window.setTimeout(()=>{
        if(onSuccess)onSuccess();
        else if(!preservePaymentJourney)navigate('taxpayer_home');
      },750);
    }catch{setError('unavailable');}
    finally{setSigningIn(false);}
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit||signingIn||step==='success') return;
    if (verifiedApplicationUser) {
      setError('already_signed_in');
      return;
    }
    if(step==='otp'){
      if(otpCode!=='111111'){setError('invalid_otp');otpRef.current?.focus();return;}
      await finishDemoSignIn(true);
      return;
    }
    const selected=getDemoUser(userId.trim().toLowerCase());
    if(!selected||password!==selected.id){setError('invalid');inputRef.current?.focus();return;}
    if(!demoOtpAlreadyEntered(selected.id)){
      setStep('otp');setOtpCode('');setError(null);return;
    }
    await finishDemoSignIn(false);
  };

  const returnToCredentials=()=>{setStep('credentials');setOtpCode('');setError(null);};

  const title = bn ? `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন` : `Sign In To Your ${taxpayerBrandName(language)} Account`;
  const content = <section className="taxpayer-login-dialog taxpayer-login-dialog--embedded">
      <form id={embedded ? 'taxpay-embedded-login-form' : 'taxpay-standalone-login-form'}
        data-demo-login-step={step} onSubmit={submit} noValidate>
        {step==='credentials'&&<>
        <div className="taxpayer-login-field">
          <label htmlFor="taxpayer-login-user-id">{bn ? 'ইউজার আইডি' : 'User ID'}</label>
          <div className="taxpayer-login-input-wrap">
            <UserRound size={18} aria-hidden="true" />
            <input ref={inputRef} id="taxpayer-login-user-id" type="text" autoComplete="username"
              autoCapitalize="none" spellCheck={false}
              placeholder={bn ? 'আপনার ইউজার আইডি লিখুন' : 'Enter your User ID'}
              aria-invalid={Boolean(error)} aria-describedby={error?'taxpayer-login-error':undefined}
              value={userId} onChange={event => { setUserId(event.target.value); setError(null); }} />
          </div>
        </div>
        <div className="taxpayer-login-field">
          <label htmlFor="taxpayer-login-password">{bn ? 'পাসওয়ার্ড' : 'Password'}</label>
          <div className="taxpayer-login-input-wrap taxpayer-login-password-wrap">
            <LockKeyhole size={18} aria-hidden="true" />
            <input id="taxpayer-login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              placeholder={bn ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter your password'}
              aria-invalid={Boolean(error)} aria-describedby={error?'taxpayer-login-error':undefined}
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
          {bn ? 'বর্তমান user1–user30 অ্যাকাউন্টের পাসওয়ার্ড তার ইউজার আইডির সমান।' : 'For the current user1–user30 accounts, the password is the same as the User ID.'}
        </p>}
        </>}
        {step==='otp'&&<div className="space-y-4">
          <p className="text-sm leading-6 text-taxpay-muted">
            {bn?'প্রথম ডেমো সাইন-ইনের জন্য কোড লিখুন। ডেমো কোড: 111111':'Enter the code for this first demo sign-in. Demo code: 111111'}
          </p>
          <div className="taxpayer-login-field">
            <label htmlFor="taxpayer-login-demo-otp">{bn?'ডেমো একবারের কোড':'Demo one-time code'}</label>
            <div className="taxpayer-login-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input ref={otpRef} id="taxpayer-login-demo-otp" data-testid="demo-otp-input" type="text"
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}"
                aria-invalid={error==='invalid_otp'} aria-describedby={error==='invalid_otp'?'taxpayer-login-error':undefined} value={otpCode}
                onChange={event=>{setOtpCode(event.target.value.replace(/\D/g,'').slice(0,6));setError(null);}} />
            </div>
          </div>
          {embedded&&<button type="button" className="taxpayer-login-recovery-row"
            onClick={returnToCredentials}>{bn?'ফিরে যান':'Back to sign in'}</button>}
        </div>}
        {step==='success'&&<p className="text-sm font-semibold text-emerald-800" role="status" aria-live="polite">
          {bn?'সাইন ইন সফল হয়েছে। আপনার অ্যাকাউন্ট খোলা হচ্ছে…':'Sign-in successful. Opening your account…'}
        </p>}
        {error && <p id="taxpayer-login-error" className="taxpayer-login-error" role="alert">
          {error === 'already_signed_in'
            ? (bn ? 'আগে বর্তমান অ্যাকাউন্ট থেকে সাইন আউট করুন।' : 'Sign out of the current account before switching users.')
            : error === 'unavailable'
              ? (bn ? 'আপনার প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।' : 'Could not load your saved profile. Please retry.')
              : error==='invalid_otp'
                ?(bn?'ডেমো কোড সঠিক নয়। 111111 লিখুন।':'Incorrect demo code. Enter 111111.')
                :(bn ? 'ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়।' : 'Incorrect User ID or password.')}
        </p>}
      </form>
    </section>;
  if (embedded) return content;
  return <TaxPayModal
    title={title}
    onClose={close}
    onBack={step==='otp'?returnToCredentials:close}
    backLabel={step==='otp'?(bn?'সাইন ইন-এ ফিরুন':'Back to sign in'):(bn ? 'ফিরুন' : 'Back')}
    closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
    className="taxpayer-login-modal"
    service="login"
    initialFocusSelector="#taxpayer-login-user-id"
    footer={<TaxpayerLoginFooter formId="taxpay-standalone-login-form" disabled={!canSubmit||signingIn||step==='success'} language={language} />}
  >
    {content}
  </TaxPayModal>;
}
