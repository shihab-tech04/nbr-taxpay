import React from 'react';
import {Landmark, ShieldAlert} from 'lucide-react';
import {useTaxState} from '../../services/taxState';

/** Citizen-only footer. The existing Officer Footer remains unchanged. */
export function CitizenFooter(){
  const {language,navigate,userRole}=useTaxState();
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
        <div><strong>TaxPay</strong><p>{bn?'স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস':'Independent tax payment workspace'}</p></div>
      </div>
      <nav className="citizen-footer__links" aria-label={bn?'সহায়তা লিংক':'Support links'}>
        {links.map(item=><button key={item.route} type="button" onClick={()=>navigate(item.route)}>
          {bn?item.bn:item.en}
        </button>)}
      </nav>
      <p className="citizen-footer__disclaimer"><ShieldAlert size={15} aria-hidden="true"/>
        {bn?'স্বতন্ত্র প্রদর্শনী। কোনো প্রকৃত অর্থ জমা, সরকারি রসিদ বা স্বীকৃত কর ক্রেডিট প্রদান করা হয় না।':
          'Independent demonstration. It does not collect money, issue an official government receipt or establish a tax credit.'}
      </p>
    </div>
  </footer>;
}
