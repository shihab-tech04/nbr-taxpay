import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, CircleHelp, Globe2, House, LayoutDashboard, LogOut, Menu, Settings2, ShieldAlert, UserRound, X } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { signOutApplicationAccount, useAccountIdentity } from '../../services/accountIdentity';
import amarKorWordmark from '../../assets/amar-kor-wordmark-tax-detail-20261018.png';
import { taxpayerBrandName } from '../../config/brand';

const ACCOUNT_ACCESS_ROUTE = 'taxpayer_login';
const LINKS = [
  {route:'landing',en:'Home',bn:'মূল পাতা',Icon:House},
  {route:'user_guide',en:'User guide',bn:'ব্যবহার নির্দেশিকা',Icon:CircleHelp},
  {route:'incident',en:'Report',bn:'অভিযোগ',Icon:ShieldAlert}
] as const;

export function PublicHomeHeader() {
  const {language,setLanguage,currentRoute,navigate,previewAccount,logoutPreviewAccount,setUserRole} = useTaxState();
  const {user,loading:checkingAccount} = useAccountIdentity();
  const signedIn = Boolean(user || previewAccount);
  const [menuOpen,setMenuOpen] = useState(false);
  const [profileOpen,setProfileOpen] = useState(false);
  const [signingOut,setSigningOut] = useState(false);
  const [signOutError,setSignOutError] = useState('');
  const [logoFailed,setLogoFailed] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuNavRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const bn = language==='bn';
  const activeRoute = currentRoute === 'guidance' ? 'user_guide' : currentRoute;
  useEffect(()=>{setMenuOpen(false);setProfileOpen(false);},[currentRoute]);
  useEffect(()=>{
    if(!profileOpen) return;
    const onPointerDown=(event:PointerEvent)=>{
      if(event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {
        event.preventDefault();setProfileOpen(false);profileButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown',onPointerDown);
    document.addEventListener('keydown',onKeyDown);
    return ()=>{document.removeEventListener('pointerdown',onPointerDown);document.removeEventListener('keydown',onKeyDown);};
  },[profileOpen]);
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
  const go=(route:string)=>{setMenuOpen(false);setProfileOpen(false);navigate(route);};
  const signOut=async()=>{
    setSignOutError('');
    if(previewAccount && !user) {setProfileOpen(false);logoutPreviewAccount();return;}
    if(!user) return;
    setSigningOut(true);
    try {
      const result=await signOutApplicationAccount();
      if(!result.ok) throw new Error(result.error);
      setUserRole('GUEST');
      window.location.assign(import.meta.env.BASE_URL);
    } catch {
      setSignOutError(bn?'সাইন আউট ব্যর্থ। আবার চেষ্টা করুন।':'Sign-out failed. Please retry.');
    } finally {setSigningOut(false);}
  };
  const routeLink=(item:typeof LINKS[number])=>
    <a key={item.route} href={item.route==='landing' ? import.meta.env.BASE_URL + (bn ? '?lang=bn' : '') : '?action='+item.route+(bn?'&lang=bn':'')}
      aria-current={activeRoute===item.route?'page':undefined}
      onClick={event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();go(item.route);
      }}>
      <item.Icon size={16} aria-hidden="true"/>{bn?item.bn:item.en}
    </a>;
  const login=(mobile:boolean)=>
    <a href={`?action=${ACCOUNT_ACCESS_ROUTE}${bn?'&lang=bn':''}`} className={mobile?'public-home-login-link public-home-login-link--mobile':'public-home-login-link public-home-login-link--desktop'}
      onClick={event=>{
        setMenuOpen(false);
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();
        go(ACCOUNT_ACCESS_ROUTE);
      }}>{bn?'লগইন':'Login'} <ArrowRight size={17} aria-hidden="true"/></a>;
  return <header className="public-home-header">
    <a className="public-home-skip-link" href="#main-content">{bn?'মূল কনটেন্টে যান':'Skip to main content'} <ArrowRight size={16} aria-hidden="true"/></a>
    <div className="public-home-header__inner">
      <a href={import.meta.env.BASE_URL + (bn ? '?lang=bn' : '')} className="public-home-brand" onClick={event=>{
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();go('landing');
      }}>
        <span className="public-home-brand__copy">
          {logoFailed ? <strong>{taxpayerBrandName(language)}</strong> : <img className="public-home-wordmark" src={amarKorWordmark} alt={taxpayerBrandName(language)} onError={()=>setLogoFailed(true)}/>}
        </span>
      </a>
      <nav ref={menuNavRef} className={menuOpen?'public-home-nav public-home-nav--open':'public-home-nav'} aria-label={bn?'প্রধান নেভিগেশন':'Primary navigation'} id="public-home-nav">
        {LINKS.map(routeLink)}{!signedIn && !checkingAccount && login(true)}
      </nav>
      <div className="public-home-header__tools">
        <button type="button" className="public-home-language" onClick={()=>setLanguage(bn?'en':'bn')} aria-label={bn?'Switch to English':'বাংলা'}>
          <Globe2 size={17} aria-hidden="true"/>{bn?'EN':'বাংলা'}
        </button>
        {signedIn ? <>
          <button type="button" className="public-home-icon-button" onClick={()=>go('account_notifications')}
            aria-label={bn?'বিজ্ঞপ্তি':'Notifications'} title={bn?'বিজ্ঞপ্তি':'Notifications'}>
            <Bell size={20} aria-hidden="true"/>
          </button>
          <div ref={profileRef} className="public-home-account">
            <button ref={profileButtonRef} type="button" className="public-home-avatar-trigger"
              aria-label={bn?'প্রোফাইল মেনু':'Profile menu'} aria-haspopup="true" aria-controls="public-home-profile-menu"
              aria-expanded={profileOpen} onClick={()=>{setMenuOpen(false);setProfileOpen(open=>!open);}}>
              <UserRound size={21} aria-hidden="true"/>
            </button>
            {profileOpen && <nav id="public-home-profile-menu" className="public-home-profile-menu" aria-label={bn?'প্রোফাইল মেনু':'Profile menu'}>
              <button type="button" onClick={()=>go('taxpayer_home')}><LayoutDashboard size={18} aria-hidden="true"/>{bn?'ড্যাশবোর্ড':'Dashboard'}</button>
              <button type="button" onClick={()=>go('account_profile')}><UserRound size={18} aria-hidden="true"/>{bn?'প্রোফাইল':'Profile'}</button>
              <button type="button" onClick={()=>go('account_settings')}><Settings2 size={18} aria-hidden="true"/>{bn?'সেটিংস':'Settings'}</button>
              <div className="public-home-profile-menu__divider" aria-hidden="true"/>
              <button type="button" disabled={signingOut} onClick={signOut}><LogOut size={18} aria-hidden="true"/>{bn?'সাইন আউট':'Sign out'}</button>
              {signOutError && <p role="alert">{signOutError}</p>}
            </nav>}
          </div>
        </> : !checkingAccount ? login(false) : null}
        <button ref={mobileMenuButtonRef} type="button" className="public-home-menu" aria-label={bn?'মেনু':'Menu'} aria-controls="public-home-nav" aria-expanded={menuOpen} onClick={()=>{setProfileOpen(false);setMenuOpen(v=>!v);}}>
          {menuOpen?<X size={21}/>:<Menu size={21}/>}
        </button>
      </div>
    </div>
  </header>;
}
