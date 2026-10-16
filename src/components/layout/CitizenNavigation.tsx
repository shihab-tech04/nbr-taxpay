import React, { useEffect, useRef, useState } from 'react';
import { Activity, Bell, BookOpen, CircleHelp, Globe2, Home, Menu, Plus, Receipt, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity, signOutApplicationAccount } from '../../services/accountIdentity';
import { UserRole } from '../../types/tax';
import amarKorWordmark from '../../assets/amar-kor-wordmark-flat-v2.png';

type CitizenAction = { route: string; en: string; bn: string; category?: string };
const guestLinks: CitizenAction[] = [
  { route: 'landing', en: 'Home', bn: 'মূল পাতা' },
  { route: 'verify', en: 'Payment Status', bn: 'পেমেন্টের অবস্থা' },
  { route: 'user_guide', category:'security', en: 'Help', bn: 'সহায়তা' }
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
  { route: 'services', en: 'Payment services', bn: 'কর পরিশোধ সেবা' },
  { route: 'account_notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি' },
  { route: 'account_profile', en: 'Profile', bn: 'প্রোফাইল' },
  { route: 'account_settings', en: 'Profile settings', bn: 'প্রোফাইল সেটিংস' },
  { route: 'user_guide', category:'security', en: 'Help', bn: 'সহায়তা' },
  { route: 'user_guide', category:'payments', en: 'Payment guide', bn: 'পেমেন্ট নির্দেশিকা' }
];
const transactionRoutes = new Set(['guest', 'guestwh', 'travel']);
const taxpayerRoles: UserRole[] = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'];

export function CitizenNavigation() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole, previewAccount, logoutPreviewAccount, setPaymentServiceChoiceOpen } = useTaxState();
  const { user: applicationUser } = useAccountIdentity();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const logOut = async () => {
    if (previewAccount && !applicationUser) {
      setMenuOpen(false);
      logoutPreviewAccount();
      return;
    }
    setSignOutError('');
    setSigningOut(true);
    try {
      const result = await signOutApplicationAccount();
      if (!result.ok) throw new Error(result.error);
      setMenuOpen(false);
      setUserRole('GUEST');
      // A full public reload discards any account-scoped in-memory state and closed-dialog remnants.
      window.location.assign(import.meta.env.BASE_URL);
    } catch { setSignOutError(language === 'bn' ? 'সাইন আউট ব্যর্থ। আবার চেষ্টা করুন।' : 'Sign-out failed. Please retry.'); }
    finally { setSigningOut(false); }
  };
  // An application session is sufficient for account navigation, not for tax-credit entitlement.
  const isTaxpayer = Boolean(applicationUser) || taxpayerRoles.includes(userRole);
  const inTransaction = transactionRoutes.has(currentRoute);
  const home = isTaxpayer ? 'taxpayer_home' : 'landing';
  const links = isTaxpayer ? taxpayerLinks : guestLinks;
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputFocusedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bn = language === 'bn';
  const label = (item: CitizenAction) => bn ? item.bn : item.en;
  const showPay = !inTransaction && currentRoute !== 'wizard' && !inputFocused;
  const go = (route: string, params: Record<string, string> = {}) => {
    setMenuOpen(false);
    setCompact(false);
    navigate(route, params);
  };
  const openPay = () => {
    setMenuOpen(false);
    setPaymentServiceChoiceOpen(true);
  };
  const goHome = () => {
    if (inTransaction && !window.confirm(bn
      ? 'আপনি কি এই পেমেন্ট ধাপ থেকে বের হবেন? এখন পর্যন্ত দেওয়া তথ্য হারিয়ে যাবে।'
      : 'Leave this payment step? The information entered so far will be lost.')) return;
    go(home);
  };
  useEffect(() => {
    setCompact(false);
    setMenuOpen(false);
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

  const overlayOpen = menuOpen;
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); return; }
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
    <button key={item.route+':'+(item.category??'')} type="button" onClick={() => go(item.route, item.category ? {category:item.category} : {})}
      aria-current={currentRoute === item.route ? 'page' : undefined}
      className="citizen-nav-link">{label(item)}</button>
  );
  return (
    <>
      <a className="public-home-skip-link" href="#main-content">{bn ? 'মূল কনটেন্টে যান' : 'Skip to main content'}</a>
      <header inert={compact && !inTransaction} className={compact && !inTransaction ? 'citizen-header citizen-header--hidden' : 'citizen-header'}>
        <div className={inTransaction ? "citizen-header__inner" : "citizen-header__inner citizen-header__inner--standard"}>
          {!inTransaction && <button type="button" className="citizen-mobile-menu-trigger" onClick={() => setMenuOpen(true)}
            aria-label={bn ? "মেনু খুলুন" : "Open menu"} aria-haspopup="dialog" aria-expanded={menuOpen}>
            <Menu size={23} aria-hidden="true" />
          </button>}
          <button type="button" className="citizen-brand" onClick={goHome}
            aria-label={bn ? 'আমার কর মূল পাতা' : 'Amar Kor home'}>
            <img className="citizen-brand__wordmark" src={amarKorWordmark} alt="" aria-hidden="true" />
            <span><small>{bn ? 'কর পরিশোধ সেবা' : 'Tax payment services'}</small></span>
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
                <button type="button" className="citizen-header__notification" onClick={() => go('account_notifications')}
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
      {!inTransaction && currentRoute !== 'wizard' && !compact && !overlayOpen && (
        <nav className="citizen-bottom-nav" aria-label={bn ? 'মোবাইল প্রধান নেভিগেশন' : 'Mobile primary navigation'}>
          {links.map(item => {
            const Icon = item.route === home ? Home : item.route === 'ledger' ? BookOpen :
              item.route === 'verify' ? Receipt : item.route === 'history' ? Activity : CircleHelp;
            return (
              <button type="button" key={item.route} onClick={()=>go(item.route, item.category ? {category:item.category} : {})}
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
      {!inTransaction && currentRoute !== 'wizard' && compact && !overlayOpen && (
        <div className="citizen-corners" aria-label={bn ? 'সংক্ষিপ্ত নেভিগেশন' : 'Compact navigation'}>
          <button className="citizen-corner citizen-corner--top-left" onClick={() => setMenuOpen(true)}
            aria-label={bn ? 'মেনু খুলুন' : 'Open menu'}><Menu aria-hidden="true"/></button>
          <button className="citizen-corner citizen-corner--top-right" onClick={() => go('account_notifications')}
            aria-label={bn ? 'বিজ্ঞপ্তি' : 'Notifications'}><Bell aria-hidden="true"/></button>
          <button className="citizen-corner citizen-corner--bottom-left" onClick={() => go(home)}
            aria-label={bn ? 'মূল পাতা' : 'Home'}><Home aria-hidden="true"/></button>
        </div>
      )}
      {showPay && !overlayOpen && (
        <button type="button" className={compact ? "citizen-pay citizen-pay--compact" : "citizen-pay citizen-pay--expanded"} onClick={openPay}
          aria-label={bn ? 'কর পরিশোধের ধরন নির্বাচন' : 'Pay — select payment type'}>
          <Plus aria-hidden="true" size={22}/><span>{bn ? 'পরিশোধ' : 'Pay'}</span>
        </button>
      )}
      {overlayOpen && (
        <div className="citizen-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}>
          <div ref={dialogRef} id="citizen-menu-dialog" className="citizen-dialog" role="dialog" aria-modal="true" aria-labelledby="citizen-dialog-title">
            <div className="citizen-dialog__title">
              <h2 id="citizen-dialog-title">{bn ? 'সেবা ও মেনু' : 'Services & menu'}</h2>
              <button type="button" onClick={() => setMenuOpen(false)}
                aria-label={bn ? 'বন্ধ করুন' : 'Close'}><X aria-hidden="true"/></button>
            </div>
            <>
                <nav className="citizen-dialog__navigation" aria-label={bn ? 'সেবার নেভিগেশন' : 'Services navigation'}>
                  <p className="citizen-dialog__section-label">{bn ? 'প্রধান নেভিগেশন' : 'Navigation'}</p>
                  <div className="citizen-dialog__links">{links.map(action)}</div>
                  <p className="citizen-dialog__section-label">{bn ? 'অন্যান্য সেবা' : 'More services'}</p>
                  <div className="citizen-dialog__links">
                    {(isTaxpayer ? moreLinks : [
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
                  {applicationUser || previewAccount ? (
                    <button type="button" className="citizen-dialog-signout" onClick={logOut} disabled={signingOut}>{bn ? 'সাইন আউট' : 'Sign out'}</button>
                  ) : (
                    <button type="button" className="citizen-dialog-signout" onClick={() => go('taxpayer_login')}>{bn ? 'সাইন ইন' : 'Sign in'}</button>
                  )}
                  {signOutError && <p role="alert" className="citizen-dialog__notice">{signOutError}</p>}
                </section>
            </>
          </div>
        </div>
      )}
    </>
  );
}
