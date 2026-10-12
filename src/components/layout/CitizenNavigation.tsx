import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, BookOpen, CreditCard, Globe2, Home, Landmark, Menu, Receipt, ShieldAlert, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
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
  { route: 'notifications', en: 'Notifications', bn: 'বিজ্ঞপ্তি' },
  { route: 'guidance', en: 'Help', bn: 'সহায়তা' },
  { route: 'secure_workspace', en: 'Account access', bn: 'অ্যাকাউন্ট প্রবেশ' }
];
const transactionRoutes = new Set(['guest', 'guestwh', 'travel', 'wizard']);
const taxpayerRoles: UserRole[] = ['TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'];

export function CitizenNavigation() {
  const { currentRoute, navigate, language, setLanguage, userRole, setUserRole } = useTaxState();
  const isTaxpayer = taxpayerRoles.includes(userRole);
  const inTransaction = transactionRoutes.has(currentRoute);
  const home = isTaxpayer ? 'taxpayer_home' : 'landing';
  const links = isTaxpayer ? taxpayerLinks : guestLinks;
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
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
      if (window.matchMedia('(min-width: 768px)').matches) { setCompact(false); return; }
      const next = window.scrollY;
      const delta = next - last;
      last = next;
      if (next < 32) { accumulated = 0; setCompact(false); return; }
      if ((delta > 0 && accumulated < 0) || (delta < 0 && accumulated > 0)) accumulated = 0;
      accumulated += delta;
      if (next > 96 && accumulated > 20) { setCompact(true); accumulated = 0; }
      if (accumulated < -14) { setCompact(false); accumulated = 0; }
    };
    const onResize = () => { if (window.innerWidth >= 768) setCompact(false); };
    const isInput = (element: EventTarget | null) => element instanceof HTMLElement &&
      Boolean(element.closest('input, textarea, select, [contenteditable="true"]'));
    const onFocusIn = (event: FocusEvent) => setInputFocused(isInput(event.target));
    const onFocusOut = () => window.requestAnimationFrame(() => setInputFocused(isInput(document.activeElement)));
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
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [overlayOpen]);

  const action = (item: CitizenAction) => (
    <button key={item.route} type="button" onClick={() => go(item.route)}
      aria-current={currentRoute === item.route ? 'page' : undefined}
      className="citizen-nav-link">{label(item)}</button>
  );
  const profileOptions: { value: UserRole; en: string; bn: string }[] = [
    { value: 'GUEST', en: 'Public guest', bn: 'সাধারণ দর্শক' },
    { value: 'TAXPAYER_INDIVIDUAL', en: 'Sample individual', bn: 'নমুনা ব্যক্তি' },
    { value: 'TAXPAYER_CORPORATE', en: 'Sample company', bn: 'নমুনা কোম্পানি' },
    { value: 'WITHHOLDING_AGENT', en: 'Sample withholding agent', bn: 'নমুনা উৎসে কর কর্তনকারী' }
  ];
  return (
    <>
      <header className={compact && !inTransaction ? 'citizen-header citizen-header--hidden' : 'citizen-header'}>
        <div className="citizen-header__inner">
          <button type="button" className="citizen-brand" onClick={() => go(home)}
            aria-label={bn ? 'TaxPay মূল পাতা' : 'TaxPay home'}>
            <Landmark aria-hidden="true" size={24} />
            <span><strong>TaxPay</strong><small>{bn ? 'স্বতন্ত্র পেমেন্ট প্রদর্শনী' : 'Independent payment demonstration'}</small></span>
          </button>
          {inTransaction ? (
            <div className="citizen-flow-actions">
              <p className="citizen-flow-label">{bn ? 'নমুনা পেমেন্ট প্রক্রিয়া · ধাপের নির্দেশনা অনুসরণ করুন' : 'Demo payment flow · use the step controls below'}</p>
              <button type="button" className="citizen-language" onClick={() => setLanguage(bn ? 'en' : 'bn')}>{bn ? 'EN' : 'বাংলা'}</button>
            </div>
          ) : (
            <>
              <nav className="citizen-header__links" aria-label={bn ? 'প্রধান নেভিগেশন' : 'Main navigation'}>
                {links.map(action)}
                {isTaxpayer && <button type="button" className="citizen-nav-link" onClick={() => setMenuOpen(true)}>{bn ? 'আরও' : 'More'}</button>}
              </nav>
              <div className="citizen-header__utilities">
                <button type="button" className="citizen-language" onClick={() => setLanguage(bn ? 'en' : 'bn')}
                  title={bn ? 'Switch to English' : 'বাংলায় দেখুন'}><Globe2 size={16} aria-hidden="true"/>{bn ? 'EN' : 'বাংলা'}</button>
                <button type="button" className="citizen-menu-open" onClick={() => setMenuOpen(true)}
                  aria-label={bn ? 'মেনু খুলুন' : 'Open menu'}><Menu size={22} aria-hidden="true"/></button>
              </div>
            </>
          )}
        </div>
      </header>
      {!inTransaction && compact && !overlayOpen && (
        <div className="citizen-corners" aria-label={bn ? 'সংক্ষিপ্ত নেভিগেশন' : 'Compact navigation'}>
          <button className="citizen-corner citizen-corner--top-left" onClick={() => setMenuOpen(true)}
            aria-label={bn ? 'মেনু খুলুন' : 'Open menu'}><Menu aria-hidden="true"/></button>
          <button className="citizen-corner citizen-corner--top-right" onClick={() => go(isTaxpayer ? 'history' : 'verify')}
            aria-label={isTaxpayer ? (bn ? 'লেনদেন' : 'Activity') : (bn ? 'পেমেন্টের অবস্থা' : 'Payment Status')}>
            {isTaxpayer ? <Activity aria-hidden="true"/> : <Receipt aria-hidden="true"/>}</button>
          <button className="citizen-corner citizen-corner--bottom-left" onClick={() => go(home)}
            aria-label={bn ? 'মূল পাতা' : 'Home'}><Home aria-hidden="true"/></button>
        </div>
      )}
      {showPay && !overlayOpen && (
        <button type="button" className="citizen-pay" onClick={openPay}
          aria-label={bn ? 'কর পরিশোধের ধরন নির্বাচন' : 'Pay — select payment type'}>
          <CreditCard aria-hidden="true" size={19}/><span>{bn ? 'পরিশোধ' : 'Pay'}</span>
        </button>
      )}
      {overlayOpen && (
        <div className="citizen-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) {setMenuOpen(false); setPayOpen(false);} }}>
          <div ref={dialogRef} className="citizen-dialog" role="dialog" aria-modal="true" aria-labelledby="citizen-dialog-title">
            <div className="citizen-dialog__title">
              <h2 id="citizen-dialog-title">{menuOpen ? (bn ? 'সেবা ও মেনু' : 'Services & menu') : (bn ? 'পেমেন্টের ধরন বাছুন' : 'Select payment type')}</h2>
              <button type="button" onClick={() => {setMenuOpen(false);setPayOpen(false);}}
                aria-label={bn ? 'বন্ধ করুন' : 'Close'}><X aria-hidden="true"/></button>
            </div>
            {menuOpen ? (
              <>
                <div className="citizen-dialog__links">{[...links, ...(isTaxpayer ? moreLinks : [
                  {route:'incident',en:'Security reporting',bn:'নিরাপত্তা অভিযোগ'},
                  {route:'head_catalogue',en:'Payment head catalogue',bn:'কর খাতের তালিকা'},
                  {route:'secure_workspace',en:'Account access',bn:'অ্যাকাউন্ট প্রবেশ'}
                ])].map(action)}</div>
                <label className="citizen-select-label" htmlFor="citizen-sample-role">{bn ? 'নমুনা প্রোফাইল (প্রকৃত লগইন নয়)' : 'Sample profile (not sign-in)'}</label>
                <select id="citizen-sample-role" value={userRole} onChange={(event) => {
                  const role = event.target.value as UserRole;
                  setUserRole(role);
                  go(role === 'GUEST' ? 'landing' : 'taxpayer_home');
                }}>{profileOptions.map(p => <option key={p.value} value={p.value}>{bn ? p.bn : p.en}</option>)}</select>
                <p className="citizen-dialog__notice"><ShieldAlert size={16} aria-hidden="true"/> {bn ? 'শুধু নমুনা তথ্য; প্রকৃত অ্যাকাউন্ট বা অনুমোদন নয়।' : 'Illustrative records only. Selecting a profile is not authentication or authorization.'}</p>
              </>
            ) : (
              <>
                <p className="citizen-dialog__intro">{bn ? 'এগুলো নমুনা পেমেন্ট প্রক্রিয়া। প্রকৃত অর্থ জমা বা কর ক্রেডিট হয় না।' : 'Explore demonstration payment journeys. No real payment or tax credit is created.'}</p>
                <div className="citizen-dialog__links">
                  {Object.entries(CATEGORY_LABELS).map(([key,item]) => (
                    <button key={key} type="button" className="citizen-payment-choice" onClick={() => chooseGuest(key)}>
                      <span>{bn ? item.bn : item.en}</span><ArrowRight size={16} aria-hidden="true"/>
                    </button>
                  ))}
                  <button type="button" className="citizen-payment-choice" onClick={() => chooseGuest('TRAVEL_TAX')}>
                    <span>{bn ? 'ভ্রমণ কর' : 'Travel Tax'}</span><ArrowRight size={16} aria-hidden="true"/>
                  </button>
                </div>
                <p className="citizen-dialog__notice"><BookOpen size={16} aria-hidden="true"/> {bn ? 'খাতের আইনগত যাচাই অসম্পূর্ণ।' : 'Payment-head legal classification remains unverified.'}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
