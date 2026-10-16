import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, UserRound, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import { taxpayerBrandName } from '../../config/brand';

/** TaxPay-only, password-free preview account entry. This does not authenticate API calls. */
export function TaxpayerLoginDialog() {
  const { language, loginPreviewAccount, navigate } = useTaxState();
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<'invalid'|'already_signed_in'|null>(null);
  const { user: verifiedApplicationUser } = useAccountIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const bn = language === 'bn';
  const close = () => navigate('landing');

  useEffect(() => {
    const lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])')];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastFocused?.focus();
    };
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (verifiedApplicationUser) {
      setError('already_signed_in');
      return;
    }
    if (!loginPreviewAccount(userId)) {
      setError('invalid');
      inputRef.current?.focus();
    }
  };

  return <div className="taxpayer-login-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) close();
  }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="taxpayer-login-title"
      className="taxpayer-login-dialog">
      <div className="taxpayer-login-heading">
        <h2 id="taxpayer-login-title">{bn ? `আপনার ${taxpayerBrandName(language)} অ্যাকাউন্টে সাইন ইন করুন` : `Sign In To Your ${taxpayerBrandName(language)} Account`}</h2>
        <button type="button" onClick={close} aria-label={bn ? 'বন্ধ করুন' : 'Close'}>
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={submit} noValidate>
        <label htmlFor="taxpayer-login-user-id">{bn ? 'ইউজার আইডি' : 'User ID'}</label>
        <div className="taxpayer-login-input-wrap">
          <UserRound size={19} aria-hidden="true" />
          <input ref={inputRef} id="taxpayer-login-user-id" type="text" autoComplete="username"
            autoCapitalize="none" spellCheck={false}
            placeholder={bn ? 'আপনার ইউজার আইডি লিখুন' : 'Enter your User ID'}
            aria-describedby="taxpayer-login-hint"
            aria-invalid={Boolean(error)}
            value={userId} onChange={event => { setUserId(event.target.value); setError(null); }} />
        </div>
        <p id="taxpayer-login-hint" className="taxpayer-login-hint">
          {bn ? 'ইউজার আইডি: user1–user10' : 'User IDs: user1–user10'}
        </p>
        {error && <p className="taxpayer-login-error" role="alert">
          {error === 'already_signed_in'
            ? (bn ? 'আগে বর্তমান অ্যাকাউন্ট থেকে সাইন আউট করুন।' : 'Sign out of the current account before switching users.')
            : (bn ? 'সঠিক ইউজার আইডি দিন (user1–user10)।' : 'Enter a valid User ID (user1–user10).')}
        </p>}
        <button className="taxpayer-login-submit" type="submit">
          {bn ? 'লগইন' : 'Login'} <ArrowRight size={19} aria-hidden="true" />
        </button>
      </form>
    </section>
  </div>;
}
