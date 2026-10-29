import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { TaxPayModal } from '../ui/TaxPayModal';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerBrandName } from '../../config/brand';

/** TaxPay-only preview account entry. This does not authenticate API calls. */
export function TaxpayerLoginDialog({ onClose, onSuccess, preservePaymentJourney = false, embedded = false, onValidityChange }: {
  onClose?: () => void;
  onSuccess?: () => void;
  preservePaymentJourney?: boolean;
  /** Reuse the parent payment modal's title, close control, overlay and footer. */
  embedded?: boolean;
  onValidityChange?: (valid: boolean) => void;
} = {}) {
  const { language, loginPreviewAccount, navigate } = useTaxState();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [error, setError] = useState<'invalid'|'already_signed_in'|null>(null);
  const { user: verifiedApplicationUser } = useAccountIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const bn = language === 'bn';
  const close = () => onClose ? onClose() : navigate('landing');
  const credentialsReady = Boolean(userId.trim() && password.trim());
  useEffect(() => { onValidityChange?.(credentialsReady); }, [credentialsReady, onValidityChange]);

  // The shared TaxPayModal owns Escape, focus containment, overlay and focus restoration.
  // Embedded login still focuses the first field when entered from the payment stepper.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!credentialsReady) return;
    if (verifiedApplicationUser) {
      setError('already_signed_in');
      return;
    }
    if (!loginPreviewAccount(userId, password, { preserveRoute: preservePaymentJourney })) {
      setError('invalid');
      inputRef.current?.focus();
    } else {
      onSuccess?.();
    }
  };

  const title = bn ? `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন` : `Sign In To Your ${taxpayerBrandName(language)} Account`;
  const content = <section className="taxpayer-login-dialog taxpayer-login-dialog--embedded">
      <form id={embedded ? 'taxpay-embedded-login-form' : 'taxpay-standalone-login-form'} onSubmit={submit} noValidate>
        <div className="taxpayer-login-field">
          <label htmlFor="taxpayer-login-user-id">{bn ? 'ইউজার আইডি' : 'User ID'}</label>
          <div className="taxpayer-login-input-wrap">
            <UserRound size={18} aria-hidden="true" />
            <input ref={inputRef} id="taxpayer-login-user-id" type="text" autoComplete="username"
              autoCapitalize="none" spellCheck={false}
              placeholder={bn ? 'আপনার ইউজার আইডি লিখুন' : 'Enter your User ID'}
              aria-invalid={Boolean(error)}
              value={userId} onChange={event => { setUserId(event.target.value); setError(null); }} />
          </div>
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
          {bn ? 'বর্তমান user1–user10 অ্যাকাউন্টের পাসওয়ার্ড তার ইউজার আইডির সমান।' : 'For the current user1–user10 accounts, the password is the same as the User ID.'}
        </p>}
        {error && <p className="taxpayer-login-error" role="alert">
          {error === 'already_signed_in'
            ? (bn ? 'আগে বর্তমান অ্যাকাউন্ট থেকে সাইন আউট করুন।' : 'Sign out of the current account before switching users.')
            : (bn ? 'ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়।' : 'Incorrect User ID or password.')}
        </p>}
      </form>
    </section>;
  if (embedded) return content;
  return <TaxPayModal
    title={title}
    onClose={close}
    closeIconLabel={bn ? 'বন্ধ করুন' : 'Close modal'}
    className="taxpayer-login-modal"
    service="login"
    initialFocusSelector="#taxpayer-login-user-id"
    footer={<button className="tax-service-choice__continue" type="submit"
      form="taxpay-standalone-login-form" disabled={!credentialsReady}>
      {bn ? 'সাইন ইন' : 'Sign In'} <ArrowRight size={18} aria-hidden="true" />
    </button>}
  >
    {content}
  </TaxPayModal>;
}
