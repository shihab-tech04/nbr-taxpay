import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, Globe2, House, Menu, ShieldAlert, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import amarKorWordmark from '../../assets/amar-kor-wordmark-approved.png';
import { TAXPAYER_BRAND, taxpayerBrandName } from '../../config/brand';

const ACCOUNT_ACCESS_ROUTE = 'taxpayer_login';
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
    <a key={item.route} href={item.route==='landing' ? import.meta.env.BASE_URL + (bn ? '?lang=bn' : '') : '?action='+item.route+(bn?'&lang=bn':'')}
      aria-current={currentRoute===item.route?'page':undefined}
      onClick={event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();navigate(item.route);setMenuOpen(false);
      }}>
      <item.Icon size={16} aria-hidden="true"/>{bn?item.bn:item.en}
    </a>;
  const login=(mobile:boolean)=>
    <a href={`?action=${ACCOUNT_ACCESS_ROUTE}${bn?'&lang=bn':''}`} className={mobile?'public-home-login-link public-home-login-link--mobile':'public-home-login-link public-home-login-link--desktop'}
      onClick={event=>{
        setMenuOpen(false);
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();
        navigate(ACCOUNT_ACCESS_ROUTE);
      }}>{bn?'লগইন':'Login'} <ArrowRight size={17} aria-hidden="true"/></a>;
  return <header className="public-home-header">
    <a className="public-home-skip-link" href="#main-content">{bn?'মূল কনটেন্টে যান':'Skip to main content'} <ArrowRight size={16} aria-hidden="true"/></a>
    <div className="public-home-header__inner">
      <a href={import.meta.env.BASE_URL + (bn ? '?lang=bn' : '')} className="public-home-brand" onClick={event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();navigate('landing');setMenuOpen(false);
      }}>
        <span className="public-home-brand__copy">
          {logoFailed ? <strong>{taxpayerBrandName(language)}</strong> : <img className="public-home-wordmark" src={amarKorWordmark} alt={taxpayerBrandName(language)} onError={()=>setLogoFailed(true)}/>}
          <small>{TAXPAYER_BRAND.tagline[language]}</small>
        </span>
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
