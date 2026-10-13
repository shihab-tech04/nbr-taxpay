import React, { useEffect, useState } from 'react';
import { ArrowRight, Globe2, Menu, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import governmentSeal from '../../assets/bangladesh-government-seal.svg';

export function PublicHomeHeader() {
  const { language, setLanguage } = useTaxState();
  const [menuOpen,setMenuOpen] = useState(false);
  const [logoFailed,setLogoFailed] = useState(false);
  const bn = language === 'bn';
  useEffect(() => { if (!menuOpen) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [menuOpen]);
  const labels=[
    {target:'#public-home-title',en:'Home',bn:'মূল পাতা'},
    {target:'#public-payment-types',en:'Payment types',bn:'পেমেন্টের ধরন'},
    {target:'#public-how-it-works',en:'How it works',bn:'যেভাবে কাজ করে'},
    {target:'#public-guides',en:'Guides',bn:'নির্দেশনা'},
    {target:'#public-faq',en:'FAQs',bn:'প্রশ্নোত্তর'}
  ];
  return <header className="public-home-header">
    <a className="public-home-skip-link" href="#main-content">{bn ? 'মূল কনটেন্টে যান' : 'Skip to main content'} <ArrowRight size={16} aria-hidden="true" /></a>
    <div className="public-home-header__inner">
      <a href="#public-home-title" className="public-home-brand" onClick={()=>setMenuOpen(false)}>
        {logoFailed ? <span className="public-home-seal-fallback" aria-hidden="true">TP</span> :
          <img src={governmentSeal} alt="Government Seal of Bangladesh" onError={()=>setLogoFailed(true)} />}
        <span className="public-home-brand__copy"><strong>TaxPay</strong><small>{bn?'স্বতন্ত্র আয়কর তথ্যসেবা':'Independent tax information service'}</small></span>
      </a>
      <nav className={menuOpen ? 'public-home-nav public-home-nav--open' : 'public-home-nav'} aria-label={bn?'প্রধান নেভিগেশন':'Primary navigation'} id="public-home-nav">
        {labels.map(item=><a href={item.target} key={item.target} onClick={()=>setMenuOpen(false)}>{bn?item.bn:item.en}</a>)}
      </nav>
      <div className="public-home-header__tools">
        <button type="button" className="public-home-language" onClick={()=>setLanguage(bn?'en':'bn')} aria-label={bn?'Switch to English':'বাংলা'}><Globe2 size={17} aria-hidden="true"/>{bn?'EN':'বাংলা'}</button>
        <button type="button" className="public-home-menu" aria-controls="public-home-nav" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)} aria-label={bn?'মেনু':'Menu'}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
      </div>
    </div>
  </header>;
}
