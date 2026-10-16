import React from 'react';
import {Landmark, ShieldAlert, ArrowUpRight} from 'lucide-react';
import governmentSeal from '../../assets/bangladesh-government-seal.svg';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';

/** Citizen-only footer. The existing Officer Footer remains unchanged. */
export function CitizenFooter(){
  const {language,navigate,userRole,currentRoute}=useTaxState();
  const {user}=useAccountIdentity();
  const bn=language==='bn';
  const isTaxpayer=Boolean(user)||['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole);
  const home=isTaxpayer?'taxpayer_home':'landing';
  const isPublic=['landing','user_guide','incident'].includes(currentRoute);
  if(isPublic) return <footer className="public-footer no-print" aria-label={bn?'TaxPay ফুটার':'TaxPay footer'}>
    <div className="public-footer__inner">
      <div className="public-footer__identity">
        <img src={governmentSeal} alt="Government Seal of Bangladesh"/>
        <div><strong>TaxPay</strong><p>{bn?'আয়কর পরিশোধের তথ্য':'Income tax payment information'}</p></div>
      </div>
      <div className="public-footer__navs">
        <section><h2>{bn?'দ্রুত লিংক':'Explore'}</h2>
          <button onClick={()=>navigate('landing')} type="button">{bn?'হোম':'Home'}</button>
          <button onClick={()=>navigate('user_guide')} type="button">{bn?'ব্যবহার নির্দেশিকা':'User guide'}</button>
          <button onClick={()=>navigate('incident')} type="button">{bn?'অভিযোগ':'Report'}</button>
        </section>
        <section><h2>{bn?'তথ্যসূত্র':'Resources'}</h2>
          <a href="https://nbr.gov.bd/" target="_blank" rel="noopener noreferrer">{bn?'এনবিআর প্রকাশনা':'NBR publications'}<ArrowUpRight size={14} aria-hidden="true"/></a>
          <button onClick={()=>navigate('user_guide',{category:'security'})} type="button">{bn?'নিরাপত্তা ও সহায়তা':'Security & support'}</button>
        </section>
      </div>
      <div className="public-footer__bottom">
        <p>{bn?'স্বতন্ত্র তথ্যসেবা; এনবিআর পরিচালিত সরকারি পোর্টাল নয়।':'Independent information service; not an NBR-operated government portal.'}</p>
        <p><ShieldAlert size={15} aria-hidden="true"/>{bn?'এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।':'No government payments or challans are issued here.'}</p>
      </div>
    </div>
  </footer>;
  const links=[
    {route:home,en:'Home',bn:'মূল পাতা'},
    {route:'verify',en:'Payment status & receipt lookup',bn:'পেমেন্টের অবস্থা ও রসিদ'},
    {route:'guidance',en:'Help',bn:'সহায়তা'},
    {route:'incident',en:'Report a security concern',bn:'নিরাপত্তা সমস্যা জানান'},
  ];
  return <footer className={`citizen-footer no-print ${currentRoute==='landing'?'citizen-footer--public':''}`} aria-label={bn?'TaxPay সহায়তা ও তথ্য':'TaxPay support and information'}>
    <div className="citizen-footer__inner">
      <div className="citizen-footer__intro">
        <Landmark size={21} aria-hidden="true"/>
        <div><strong>TaxPay</strong><p>{currentRoute==='landing' ? (bn?'আয়কর পরিশোধের তথ্য':'Income tax payment information') : (bn?'স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস':'Independent tax payment workspace')}</p></div>
      </div>
      <nav className="citizen-footer__links" aria-label={bn?'সহায়তা লিংক':'Support links'}>
        {links.map(item=><button key={item.route} type="button" onClick={()=>navigate(item.route)}>
          {bn?item.bn:item.en}
        </button>)}
      </nav>
      {currentRoute==='landing' && <p className="citizen-footer__independence">{bn?'স্বতন্ত্র তথ্যসেবা; এটি জাতীয় রাজস্ব বোর্ড পরিচালিত সরকারি পোর্টাল নয়।':'Independent information service; this is not an NBR-operated government portal.'}</p>}
      {currentRoute==='landing' && <p className="citizen-footer__disclaimer"><ShieldAlert size={15} aria-hidden="true"/>
        {bn?'এই তথ্যসেবা অর্থ গ্রহণ বা সরকারি চালান ইস্যু করে না।':'This information service does not collect money or issue official challans.'}
      </p>}
    </div>
  </footer>;
}
