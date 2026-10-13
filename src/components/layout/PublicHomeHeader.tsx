import React, { useEffect, useState } from 'react';
import { ArrowRight, Globe2, Menu, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import governmentSeal from '../../assets/bangladesh-government-seal.svg';

const LOGIN_URL = 'https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions';
const NAV_ITEMS = [
  {id:'public-home-title',en:'Home',bn:'মূল পাতা'},
  {id:'public-payment-types',en:'Payment types',bn:'পেমেন্টের ধরন'},
  {id:'public-how-it-works',en:'How it works',bn:'যেভাবে কাজ করে'},
  {id:'public-guides',en:'Guides',bn:'নির্দেশনা'},
  {id:'public-faq',en:'FAQs',bn:'প্রশ্নোত্তর'}
] as const;

/** Public-only navigation; the taxpayer and Officer layouts are unchanged. */
export function PublicHomeHeader() {
  const { language, setLanguage } = useTaxState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [activeId, setActiveId] = useState<string>('public-home-title');
  const bn = language === 'bn';

  useEffect(() => {
    const updateActive = () => {
      let next: string = NAV_ITEMS[0].id;
      for (const item of NAV_ITEMS) {
        const section = document.getElementById(item.id);
        if (section && section.getBoundingClientRect().top <= 148) next = item.id;
      }
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10) {
        next = NAV_ITEMS[NAV_ITEMS.length - 1].id;
      }
      setActiveId(previous => previous === next ? previous : next);
    };
    window.addEventListener('scroll', updateActive, {passive: true});
    window.addEventListener('resize', updateActive);
    window.addEventListener('hashchange', updateActive);
    updateActive();
    return () => {
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
      window.removeEventListener('hashchange', updateActive);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);

  const loginLabel = bn ? 'লগইন' : 'Login';
  const login = (mobile: boolean) => (
    <a className={mobile ? 'public-home-login-link public-home-login-link--mobile' : 'public-home-login-link public-home-login-link--desktop'}
       href={LOGIN_URL} onClick={() => setMenuOpen(false)}>
      {loginLabel} <ArrowRight size={17} aria-hidden="true" />
    </a>
  );

  return <header className="public-home-header">
    <a className="public-home-skip-link" href="#main-content">{bn ? 'মূল কনটেন্টে যান' : 'Skip to main content'} <ArrowRight size={16} aria-hidden="true" /></a>
    <div className="public-home-header__inner">
      <a href="#public-home-title" className="public-home-brand" onClick={() => {setActiveId('public-home-title');setMenuOpen(false);}}>
        {logoFailed ? <span className="public-home-seal-fallback" aria-hidden="true">TP</span> :
          <img src={governmentSeal} alt="Government Seal of Bangladesh" onError={() => setLogoFailed(true)} />}
        <span className="public-home-brand__copy"><strong>TaxPay</strong><small>{bn ? 'স্বতন্ত্র আয়কর তথ্যসেবা' : 'Independent tax information service'}</small></span>
      </a>
      <nav className={menuOpen ? 'public-home-nav public-home-nav--open' : 'public-home-nav'} aria-label={bn ? 'প্রধান নেভিগেশন' : 'Primary navigation'} id="public-home-nav">
        {NAV_ITEMS.map(item => (
          <a key={item.id} href={'#' + item.id} aria-current={activeId === item.id ? 'location' : undefined}
             onClick={() => {setActiveId(item.id);setMenuOpen(false);}}>
            {bn ? item.bn : item.en}
          </a>
        ))}
        {login(true)}
      </nav>
      <div className="public-home-header__tools">
        <button type="button" className="public-home-language" onClick={() => setLanguage(bn ? 'en' : 'bn')} aria-label={bn ? 'Switch to English' : 'বাংলা'}>
          <Globe2 size={17} aria-hidden="true" />{bn ? 'EN' : 'বাংলা'}
        </button>
        {login(false)}
        <button type="button" className="public-home-menu" aria-controls="public-home-nav" aria-expanded={menuOpen}
          onClick={() => setMenuOpen(value => !value)} aria-label={bn ? 'মেনু' : 'Menu'}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </div>
  </header>;
}
