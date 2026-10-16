import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import amarKorWordmark from '../../assets/amar-kor-wordmark-flat-v2.png';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import { taxpayerBrandName } from '../../config/brand';

/** Citizen-only footer. The existing Officer Footer remains unchanged. */
export function CitizenFooter(){
  const {language,navigate,userRole,currentRoute}=useTaxState();
  const {user}=useAccountIdentity();
  const bn=language==='bn';
  const isTaxpayer=Boolean(user)||['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole);
  const home=isTaxpayer?'taxpayer_home':'landing';
  const isPublic=['landing','user_guide','incident'].includes(currentRoute);
  if(isPublic) return <footer className="public-footer no-print" aria-label={bn?'আমার কর ফুটার':'Amar Kor footer'}>
    <div className="public-footer__inner">
      <div className="public-footer__identity">
        <img className="public-footer__wordmark" src={amarKorWordmark} alt={taxpayerBrandName(language)}/>
        <p>{bn?'আয়কর পরিশোধের তথ্য':'Income tax payment information'}</p>
      </div>
      <nav className="public-footer__navs" aria-label={bn?'ফুটার নেভিগেশন':'Footer navigation'}>
        <button onClick={()=>navigate('landing')} type="button">{bn?'হোম':'Home'}</button>
        <button onClick={()=>navigate('user_guide')} type="button">{bn?'ব্যবহার নির্দেশিকা':'User guide'}</button>
        <button onClick={()=>navigate('incident')} type="button">{bn?'অভিযোগ':'Report'}</button>
        <a href="https://nbr.gov.bd/" target="_blank" rel="noopener noreferrer">{bn?'এনবিআর প্রকাশনা':'NBR publications'}<ArrowUpRight size={14} aria-hidden="true"/></a>
        <button onClick={()=>navigate('user_guide',{category:'security'})} type="button">{bn?'নিরাপত্তা ও সহায়তা':'Security & support'}</button>
      </nav>
      <div className="public-footer__bottom">
        <p>{bn?'© ২০২৬ আমার কর':'© 2026 Amar Kor'}</p>
      </div>
    </div>
  </footer>;
  const links=[
    {route:home,en:'Home',bn:'মূল পাতা'},
    {route:'verify',en:'Payment status & receipt lookup',bn:'পেমেন্টের অবস্থা ও রসিদ'},
    {route:'guidance',en:'Help',bn:'সহায়তা'},
    {route:'incident',en:'Report a security concern',bn:'নিরাপত্তা সমস্যা জানান'},
  ];
  return <footer className={`citizen-footer no-print ${currentRoute==='landing'?'citizen-footer--public':''}`} aria-label={bn?'আমার কর সহায়তা ও তথ্য':'Amar Kor support and information'}>
    <div className="citizen-footer__inner">
      <div className="citizen-footer__intro">
        <div><img className="citizen-footer__wordmark" src={amarKorWordmark} alt={taxpayerBrandName(language)}/><p>{currentRoute==='landing' ? (bn?'আয়কর পরিশোধের তথ্য':'Income tax payment information') : (bn?'কর পরিশোধ ওয়ার্কস্পেস':'Tax payment workspace')}</p></div>
      </div>
      <nav className="citizen-footer__links" aria-label={bn?'সহায়তা লিংক':'Support links'}>
        {links.map(item=><button key={item.route} type="button" onClick={()=>navigate(item.route)}>
          {bn?item.bn:item.en}
        </button>)}
      </nav>
    </div>
  </footer>;
}
