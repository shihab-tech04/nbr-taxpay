import React from 'react';
import {Landmark, ShieldAlert} from 'lucide-react';
import {useTaxState} from '../../services/taxState';

/** Citizen-only footer. The existing Officer Footer remains unchanged. */
export function CitizenFooter(){
  const {language,navigate,userRole,currentRoute}=useTaxState();
  const bn=language==='bn';
  const isTaxpayer=['TAXPAYER_INDIVIDUAL','TAXPAYER_CORPORATE','WITHHOLDING_AGENT'].includes(userRole);
  const home=isTaxpayer?'taxpayer_home':'landing';
  const links=[
    {route:home,en:'Home',bn:'মূল পাতা'},
    {route:'verify',en:'Payment status & receipt lookup',bn:'পেমেন্টের অবস্থা ও রসিদ'},
    {route:'guidance',en:'Help',bn:'সহায়তা'},
    {route:'incident',en:'Report a security concern',bn:'নিরাপত্তা সমস্যা জানান'},
  ];
  return <footer className="citizen-footer no-print" aria-label={bn?'TaxPay সহায়তা ও তথ্য':'TaxPay support and information'}>
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
      <p className="citizen-footer__disclaimer"><ShieldAlert size={15} aria-hidden="true"/>
        {currentRoute==='landing' ? (bn?'এই তথ্যসেবা অর্থ গ্রহণ বা সরকারি চালান ইস্যু করে না।':'This information service does not collect money or issue official challans.') : (bn?'শুধু প্রিভিউ · প্রকৃত পেমেন্ট বা সরকারি রসিদ ইস্যু হয় না।':'Preview only · No payments or government receipts issued.')}
      </p>
    </div>
  </footer>;
}
