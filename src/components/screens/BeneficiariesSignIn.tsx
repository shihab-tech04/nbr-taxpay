import React, { useState } from 'react';
import { LockKeyhole, UsersRound } from 'lucide-react';
import { UiButton, UiInput } from '../ui/Controls';
import { backendConfigured, supabase } from '../../services/supabaseClient';
import { authRedirectUrl } from '../../services/secureWorkspacePolicy';

/** A private deep link is an entry to real Auth, never a sample-account picker.
 * AccountIdentityProvider owns the verified session; App renders Beneficiaries
 * only after that provider resolves an authenticated identity.
 */
export function BeneficiariesSignIn({
  language, onBack,
}: {
  language: 'en' | 'bn';
  onBack: () => void;
}) {
  const bn = language === 'bn';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const requestSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      // The whitelist-backed callback is always the same private destination.
      // Never accept an arbitrary redirect from the URL or an unverified role.
      const redirectTo = authRedirectUrl(
        window.location.origin, import.meta.env.BASE_URL, undefined, 'beneficiaries', language
      );
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      setMessage({
        error: false,
        text: bn
          ? 'আপনার ইমেইলে নিরাপদ সাইন-ইন লিংক পাঠানো হয়েছে। সাইন ইন হলে আপনি উপকারভোগী পাতায় ফিরবেন।'
          : 'Check your email for a secure sign-in link. After signing in, you will return to Beneficiaries.',
      });
    } catch {
      setMessage({
        error: true,
        text: bn
          ? 'সাইন-ইন লিংক পাঠানো যায়নি। ইমেইল ঠিকানা যাচাই করে আবার চেষ্টা করুন।'
          : 'Could not send the sign-in link. Check the email address and try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="beneficiary-sign-in" data-testid="beneficiary-sign-in"
      aria-labelledby="beneficiary-sign-in-title">
      <span className="beneficiary-sign-in__symbol" aria-hidden="true"><UsersRound size={24}/></span>
      <h1 id="beneficiary-sign-in-title">
        {bn ? 'উপকারভোগী দেখতে সাইন ইন করুন' : 'Sign in to manage beneficiaries'}
      </h1>
      <p className="beneficiary-sign-in__description">
        {bn
          ? 'আপনার সংরক্ষিত উপকারভোগীর তালিকা ব্যক্তিগত। সাইন ইন করলে সরাসরি তালিকায় ফিরে যাবেন।'
          : 'Your saved beneficiary lists are private. Sign in to open your lists directly.'}
      </p>
      {!backendConfigured ? (
        <p className="beneficiary-sign-in__message beneficiary-sign-in__message--error" role="alert">
          {bn ? 'সাইন-ইন সেবা এখন উপলব্ধ নয়। পরে আবার চেষ্টা করুন।' : 'Sign-in is currently unavailable. Please try again later.'}
        </p>
      ) : (
        <form onSubmit={requestSignIn} className="beneficiary-sign-in__form">
          <label htmlFor="beneficiary-sign-in-email">
            {bn ? 'ইমেইল ঠিকানা' : 'Email address'}
          </label>
          <UiInput id="beneficiary-sign-in-email" type="email" autoComplete="email"
            name="email" required maxLength={254} value={email}
            placeholder={bn ? 'আপনার ইমেইল লিখুন' : 'Enter your email address'}
            onChange={event => { setEmail(event.target.value); if (message) setMessage(null); }}
            disabled={busy}/>
          <div className="beneficiary-sign-in__actions">
            <UiButton type="submit" disabled={busy || !email.trim()}>
              <LockKeyhole size={17} aria-hidden="true"/>
              {busy
                ? (bn ? 'লিংক পাঠানো হচ্ছে…' : 'Sending link…')
                : (bn ? 'সাইন-ইন লিংক পাঠান' : 'Email sign-in link')}
            </UiButton>
            <UiButton type="button" variant="outline" onClick={onBack}>
              {bn ? 'মূল পাতায় ফিরুন' : 'Back to Home'}
            </UiButton>
          </div>
          {message && <p className={message.error
            ? 'beneficiary-sign-in__message beneficiary-sign-in__message--error'
            : 'beneficiary-sign-in__message'} role={message.error ? 'alert' : 'status'}
            aria-live="polite">{message.text}</p>}
        </form>
      )}
    </section>
  );
}
