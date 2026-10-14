import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, Globe2, House, Menu, ShieldAlert, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import governmentSeal from '../../assets/bangladesh-government-seal.svg';

const LOGIN_URL = 'https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions';
const LINKS = [
  {route:'landing',en:'Home',bn:'মূল পাতা',Icon:House},
  {route:'user_guide',en:'FAQs',bn:'প্রশ্নোত্তর',Icon:CircleHelp},
  {route:'incident',en:'Report',bn:'অভিযোগ',Icon:ShieldAlert}
] as const;

export function PublicHomeHeader() {
  const {language,setLanguage,currentRoute,navigate} = useTaxState();
  const [menuOpen,setMenuOpen] = useState(false);
  const [logoFailed,setLogoFailed] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuNavRef = useRef<HTMLElement>(null);
  const bn = language==='bn';
  useEffect(()=>{
    if(!menuOpen) return;
    if (window.matchMedia('(max-width: 900px)').matches) {
      menuNavRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
    }
    const dismiss=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {
        event.preventDefault();
        setMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown',dismiss);
    return ()=>document.removeEventListener('keydown',dismiss);
  },[menuOpen]);
  const routeLink=(item:typeof LINKS[number])=>
    <a key={item.route} href={item.route==='landing' ? import.meta.env.BASE_URL : '?action='+item.route}
      aria-current={currentRoute===item.route?'page':undefined}
      onClick={event=>{event.preventDefault();navigate(item.route);setMenuOpen(false);}}>
      <item.Icon size={16} aria-hidden="true"/>{bn?item.bn:item.en}
    </a>;
  const login=(mobile:boolean)=>
    <a href={LOGIN_URL} className={mobile?'public-home-login-link public-home-login-link--mobile':'public-home-login-link public-home-login-link--desktop'}
      onClick={()=>setMenuOpen(false)}>{bn?'লগইন':'Login'} <ArrowRight size={17} aria-hidden="true"/></a>;
  return <header className="public-home-header">
    <a className="public-home-skip-link" href="#main-content">{bn?'মূল কনটেন্টে যান':'Skip to main content'} <ArrowRight size={16} aria-hidden="true"/></a>
    <div className="public-home-header__inner">
      <a href={import.meta.env.BASE_URL} className="public-home-brand" onClick={event=>{event.preventDefault();navigate('landing');setMenuOpen(false);}}>
        {logoFailed?<span className="public-home-seal-fallback" aria-hidden="true">TP</span>:<img src={governmentSeal} alt="Government Seal of Bangladesh" onError={()=>setLogoFailed(true)}/>}
        <span className="public-home-brand__copy"><strong>TaxPay</strong><small>{bn?'স্বতন্ত্র আয়কর তথ্যসেবা':'Independent tax information service'}</small></span>
      </a>
      <nav ref={menuNavRef} className={menuOpen?'public-home-nav public-home-nav--open':'public-home-nav'} aria-label={bn?'প্রধান নেভিগেশন':'Primary navigation'} id="public-home-nav">
        {LINKS.map(routeLink)}{login(true)}
      </nav>
      <div className="public-home-header__tools">
        <button type="button" className="public-home-language" onClick={()=>setLanguage(bn?'en':'bn')} aria-label={bn?'Switch to English':'বাংলা'}>
          <Globe2 size={17} aria-hidden="true"/>{bn?'EN':'বাংলা'}
        </button>
        {login(false)}
        <button ref={mobileMenuButtonRef} type="button" className="public-home-menu" aria-label={bn?'মেনু':'Menu'} aria-controls="public-home-nav" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>
          {menuOpen?<X size={21}/>:<Menu size={21}/>}
        </button>
      </div>
    </div>
  </header>;
}
