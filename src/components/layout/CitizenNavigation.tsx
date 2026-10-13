import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, Bell, BookOpen, CircleHelp, Globe2, Home, Landmark, Menu, Plus, Receipt, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';
import { CATEGORY_LABELS } from '../../data/paymentHeads';
import { PaymentCategory, UserRole } from '../../types/tax';

type CitizenAction = { route: string; en: string; bn: string };
const guestLinks: CitizenAction[] = [
  { route: 'landing', en: 'Home', bn: 'মূল পাতা' },
  { route: 'verify', en: 'Payment Status', bn: 'পেমেন্টের অবস্থা' },
  { route: 'guidance', en: 'Help', bn: 'সহায়তা' }
];
const taxpayerLinks: CitizenAction[] = [
  { route: 'taxpayer_home', en: 'Home', bn: 'মূল পাতা' },
  { route: 'history', en: 'Activity', bn: 'লেনদেন' },
  { route: 'ledger', en: 'Tax Ledger', bn: 'কর লেজার' }
];
const moreLinks: CitizenAction[] = [
  { route: 'certificates', en: 'Certificates', bn: 'সনদ' },
  { route: 'corrections', en: 'Corrections', bn: 'সংশোধন' },
  { route: 'journey', en: 'Tax Journey', bn: 'কর যাত্রা' },
  { route: 'services', en: 'Connected Services', bn: 'সংযুক্ত সেবা' },
  { route: 'account_notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি' },
  { route: 'account_profile', en: 'Profile', bn: 'প্রোফাইল' },
  { route: 'account_settings', en: 'Profile settings', bn: 'প্রোফাইল সেটিংস' },
  { route: 'guidance', en: 'Help', bn: 'সহায়তা' },
  { route: 'secure_workspace', en: 'Account access', bn: 'অ্যাকাউন্ট প্রবেশ' }
];
const transactionRoutes = new Set(['guest', 'guestwh', 'travel']);
const taxpayerRoles: UserRole[] = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'];

export function CitizenNavigation() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole } = useTaxState();
  const { user: applicationUser } = useAccountIdentity();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const logOut = async () => {
    setSignOutError('');
    setSigningOut(true);
    try {
      const result = await signOutApplicationAccount();
      if (!result.ok) throw new Error(result.error);
      setMenuOpen(false); setPayOpen(false);
      setUserRole('GUEST');
      // A full public reload discards any account-scoped in-memory state and closed-dialog remnants.
      window.location.assign(import.meta.env.BASE_URL);
    } catch { setSignOutError(language === 'bn' ? 'সাইন আউট ব্যর্থ। আবার চেষ্টা করুন।' : 'Sign-out failed. Please retry.'); }
    finally { setSigningOut(false); }
  };
  const isTaxpayer = taxpayerRoles.includes(userRole) || Boolean(applicationUser);
  const inTransaction = transactionRoutes.has(currentRoute);
  const home = isTaxpayer ? 'taxpayer_home' : 'landing';
  const links = isTaxpayer ? taxpayerLinks : guestLinks;
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputFocusedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bn = language === 'bn';
  const label = (item: CitizenAction) => bn ? item.bn : item.en;
  const showPay = !inTransaction && !inputFocused;
  const go = (route: string) => {
    setMenuOpen(false);
    setPayOpen(false);
    setCompact(false);
    navigate(route);
  };
  const openPay = () => {
    setMenuOpen(false);
    if (isTaxpayer) go('wizard');
    else setPayOpen(true);
  };
  const goHome = () => {
    if (inTransaction && !window.confirm(bn
      ? 'আপনি কি এই পেমেন্ট ধাপ থেকে বের হবেন? এখন পর্যন্ত দেওয়া তথ্য হারিয়ে যাবে।'
      : 'Leave this payment step? The information entered so far will be lost.')) return;
    go(home);
  };
  const chooseGuest = (key: string) => {
    if (key === 'TRAVEL_TAX') { go('travel'); return; }
    if (key === 'SOURCE_TAX_DEPOSIT') { go('guestwh'); return; }
    setMenuOpen(false);
    setPayOpen(false);
    setCompact(false);
    navigate('guest', { initialCategory: key as PaymentCategory });
  };

  useEffect(() => {
    setCompact(false);
    setMenuOpen(false);
    setPayOpen(false);
  }, [currentRoute, userRole]);

  useEffect(() => {
    if (inTransaction) return;
    let last = window.scrollY;
    let accumulated = 0;
    const onScroll = () => {
      if (inputFocusedRef.current) { accumulated = 0; setCompact(false); return; }
      if (window.matchMedia('(min-width: 901px)').matches) { setCompact(false); return; }
      const next = window.scrollY;
      const delta = next - last;
      last = next;
      if (next < 72) { accumulated = 0; setCompact(false); return; }
      if (Math.abs(delta) < 2) return;
      if ((delta > 0 && accumulated < 0) || (delta < 0 && accumulated > 0)) accumulated = 0;
      accumulated += delta;
      if (next > 145 && accumulated > 28) { setCompact(true); accumulated = 0; }
      if (accumulated < -24) { setCompact(false); accumulated = 0; }
    };
    const onResize = () => { if (window.innerWidth > 900) setCompact(false); };
    const isInput = (element: EventTarget | null) => element instanceof HTMLElement &&
      Boolean(element.closest('input, textarea, select, [contenteditable="true"]'));
    const onFocusIn = (event: FocusEvent) => {
      const focused = isInput(event.target);
      inputFocusedRef.current = focused;
      if (focused) { accumulated = 0; setCompact(false); }
      setInputFocused(focused);
    };
    const onFocusOut = () => window.requestAnimationFrame(() => {
      const focused = isInput(document.activeElement);
      inputFocusedRef.current = focused;
      setInputFocused(focused);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [inTransaction]);

  const overlayOpen = menuOpen || payOpen;
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); setPayOpen(false); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled])')];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault(); buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault(); buttons[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [overlayOpen]);

  const action = (item: CitizenAction) => (
    <button key={item.route} type="button" onClick={() => go(item.route)}
      aria-current={currentRoute === item.route ? 'page' : undefined}
      className="citizen-nav-link">{label(item)}</button>
  );
  return (
    <>
      <header className={compact && !inTransaction ? 'citizen-header citizen-header--hidden' : 'citizen-header'}>
        <div className={inTransaction ? "citizen-header__inner" : "citizen-header__inner citizen-header__inner--standard"}>
          {!inTransaction && <button type="button" className="citizen-mobile-menu-trigger" onClick={() => setMenuOpen(true)}
            aria-label={bn ? "মেনু খুলুন" : "Open menu"} aria-haspopup="dialog" aria-expanded={menuOpen}>
            <Menu size={23} aria-hidden="true" />
          </button>}
          <button type="button" className="citizen-brand" onClick={goHome}
            aria-label={bn ? 'TaxPay মূল পাতা' : 'TaxPay home'}>
            <Landmark aria-hidden="true" size={24} />
            <span><strong>TaxPay</strong><small>{bn ? 'কর পরিশোধ সেবা' : 'Tax payment services'}</small></span>
          </button>
          {inTransaction ? (
            <div className="citizen-flow-actions">
              <p className="citizen-flow-label">{bn ? 'পেমেন্টের ধাপ · নিচের নির্দেশনা অনুসরণ করুন' : 'Payment steps · follow the instructions below'}</p>
              <button type="button" className="citizen-language" onClick={() => setLanguage(bn ? 'en' : 'bn')}>{bn ? 'EN' : 'বাংলা'}</button>
            </div>
          ) : (
            <>
              <nav className="citizen-header__links" aria-label={bn ? 'প্রধান নেভিগেশন' : 'Main navigation'}>
                {links.map(action)}
                {isTaxpayer && <button type="button" className="citizen-nav-link" onClick={() => setMenuOpen(true)}>{bn ? 'আরও' : 'More'}</button>}
              </nav>
              <div className="citizen-header__utilities">
                <button type="button" className="citizen-header__notification" onClick={() => go(isTaxpayer ? 'account_notifications' : 'secure_workspace')}
                  aria-label={bn ? 'বিজ্ঞপ্তি' : 'Notifications'} title={bn ? 'বিজ্ঞপ্তি' : 'Notifications'}><Bell size={23} aria-hidden="true"/></button>
                <button type="button" className="citizen-language citizen-desktop-control" onClick={() => setLanguage(bn ? 'en' : 'bn')}
                  title={bn ? 'Switch to English' : 'বাংলায় দেখুন'}><Globe2 size={16} aria-hidden="true"/>{bn ? 'EN' : 'বাংলা'}</button>
                <button type="button" className="citizen-menu-open citizen-desktop-control" onClick={() => setMenuOpen(true)}
                  aria-label={bn ? 'মেনু খুলুন' : 'Open menu'} aria-haspopup="dialog" aria-expanded={menuOpen}><Menu size={22} aria-hidden="true"/></button>
              </div>
            </>
          )}
        </div>
      </header>
      {!inTransaction && !compact && !overlayOpen && (
        <nav className="citizen-bottom-nav" aria-label={bn ? 'মোবাইল প্রধান নেভিগেশন' : 'Mobile primary navigation'}>
          {links.map(item => {
            const Icon = item.route === home ? Home : item.route === 'ledger' ? BookOpen :
              item.route === 'verify' ? Receipt : item.route === 'history' ? Activity : CircleHelp;
            return (
              <button type="button" key={item.route} onClick={()=>go(item.route)}
                aria-current={currentRoute === item.route ? 'page' : undefined}
                className="citizen-bottom-nav__item">
                <Icon size={20} aria-hidden="true"/>
                <span>{label(item)}</span>
              </button>
            );
          })}
          <span aria-hidden="true" className="citizen-bottom-nav__pay-space"/>
        </nav>
      )}
      {!inTransaction && compact && !overlayOpen && (
        <div className="citizen-corners" aria-label={bn ? 'সংক্ষিপ্ত নেভিগেশন' : 'Compact navigation'}>
          <button className="citizen-corner citizen-corner--top-left" onClick={() => setMenuOpen(true)}
            aria-label={bn ? 'মেনু খুলুন' : 'Open menu'}><Menu aria-hidden="true"/></button>
          <button className="citizen-corner citizen-corner--top-right" onClick={() => go(isTaxpayer ? 'account_notifications' : 'secure_workspace')}
            aria-label={bn ? 'বিজ্ঞপ্তি' : 'Notifications'}><Bell aria-hidden="true"/></button>
          <button className="citizen-corner citizen-corner--bottom-left" onClick={() => go(home)}
            aria-label={bn ? 'মূল পাতা' : 'Home'}><Home aria-hidden="true"/></button>
        </div>
      )}
      {showPay && !overlayOpen && (
        <button type="button" className={compact ? "citizen-pay citizen-pay--compact" : "citizen-pay citizen-pay--expanded"} onClick={openPay}
          aria-label={isTaxpayer ? (bn ? 'পেমেন্ট করুন' : 'Make Payment') : (bn ? 'কর পরিশোধের ধরন নির্বাচন' : 'Pay — select payment type')}>
          <Plus aria-hidden="true" size={22}/><span>{bn ? 'পরিশোধ' : 'Pay'}</span>
        </button>
      )}
      {overlayOpen && (
        <div className="citizen-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) {setMenuOpen(false); setPayOpen(false);} }}>
          <div ref={dialogRef} id="citizen-menu-dialog" className="citizen-dialog" role="dialog" aria-modal="true" aria-labelledby="citizen-dialog-title">
            <div className="citizen-dialog__title">
              <h2 id="citizen-dialog-title">{menuOpen ? (bn ? 'সেবা ও মেনু' : 'Services & menu') : (bn ? 'পেমেন্টের ধরন বাছুন' : 'Select payment type')}</h2>
              <button type="button" onClick={() => {setMenuOpen(false);setPayOpen(false);}}
                aria-label={bn ? 'বন্ধ করুন' : 'Close'}><X aria-hidden="true"/></button>
            </div>
            {menuOpen ? (
              <>
                <nav className="citizen-dialog__navigation" aria-label={bn ? 'সেবার নেভিগেশন' : 'Services navigation'}>
                  <p className="citizen-dialog__section-label">{bn ? 'প্রধান নেভিগেশন' : 'Navigation'}</p>
                  <div className="citizen-dialog__links">{links.map(action)}</div>
                  <p className="citizen-dialog__section-label">{bn ? 'অন্যান্য সেবা' : 'More services'}</p>
                  <div className="citizen-dialog__links">
                    {(isTaxpayer ? moreLinks.filter(item => item.route !== 'secure_workspace') : [
                      {route:'incident',en:'Security reporting',bn:'নিরাপত্তা অভিযোগ'},
                      {route:'head_catalogue',en:'Payment head catalogue',bn:'কর খাতের তালিকা'}
                    ]).map(action)}
                  </div>
                </nav>
                <section className="citizen-dialog__account" aria-label={bn ? 'ভাষা ও অ্যাকাউন্ট' : 'Language and account'}>
                  <div className="citizen-dialog__language-row">
                    <p>{bn ? 'ভাষা' : 'Language'}</p>
                    <button type="button" className="citizen-dialog-language" onClick={() => setLanguage(bn ? 'en' : 'bn')}>
                      <Globe2 size={18} aria-hidden="true"/>{bn ? 'English' : 'বাংলা'}
                    </button>
                  </div>
                  {applicationUser ? (
                    <button type="button" className="citizen-dialog-signout" onClick={logOut} disabled={signingOut}>{bn ? 'সাইন আউট' : 'Sign out'}</button>
                  ) : (
                    <button type="button" className="citizen-dialog-signout" onClick={() => go('secure_workspace')}>{bn ? 'সাইন ইন' : 'Sign in'}</button>
                  )}
                  {signOutError && <p role="alert" className="citizen-dialog__notice">{signOutError}</p>}
                </section>
              </>
            ) : (
              <>
                <p className="citizen-dialog__intro">{bn ? 'পেমেন্টের ধরন দেখুন। প্রকৃত অর্থ জমা হয় না।' : 'Preview payment options. No funds are transferred.'}</p>
                <div className="citizen-dialog__links">
                  {Object.entries(CATEGORY_LABELS).map(([key,item]) => (
                    <button key={key} type="button" className="citizen-payment-choice" onClick={() => chooseGuest(key)}>
                      <span>{key === 'OTHER_TAX_PAYMENT' ? (bn ? 'অন্যান্য কর পরিশোধ' : 'Other Tax Payment') : (bn ? item.bn : item.en)}</span><ArrowRight size={16} aria-hidden="true"/>
                    </button>
                  ))}
                  <button type="button" className="citizen-payment-choice" onClick={() => chooseGuest('TRAVEL_TAX')}>
                    <span>{bn ? 'ভ্রমণ কর' : 'Travel Tax'}</span><ArrowRight size={16} aria-hidden="true"/>
                  </button>
                </div>
                <p className="citizen-dialog__notice"><BookOpen size={16} aria-hidden="true"/> {bn ? 'পেমেন্টের খাত পর্যালোচনাধীন।' : 'Payment heads under review.'}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
