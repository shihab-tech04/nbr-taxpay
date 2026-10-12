import React, {useState} from 'react';
import {BookOpen, Globe2, Landmark} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {OfficeThemeProvider} from '../office-ui/OfficeTheme';
import {OfficeSourceLoginSlider} from '../office-ui/auth/OfficeSourceLoginSlider';
import {OfficeModal, OfficeButton} from '../office-ui/OfficeControls';

// Layout, login hierarchy, copy positions, image carousel and controls are
// source-grounded in OfficeManagement/LoginPage, LoginForm and LoginSlider.
// TaxPay is independent: no NBR crest, government endorsement, or simulated sign-in.
const STRINGS={
 en:{brand:'TaxPay',subtitle:'Independent Tax Payment Workspace',heading:'Welcome back',intro:'Sign in to access your workspace.',id:'User ID',idHint:'Enter your User ID',pw:'Password',pwHint:'Enter your password',remember:'Remember me',forgot:'Forgot password?',submit:'Sign in',help:'Help & User Guide',demoButton:'Explore TaxPay',guideTitle:'Help & User Guide',guideCopy:'For access information, contact the project administrator.',guideClose:'Close',slides:[['Review payment steps','Find the payment workflow and supporting information.'],['Understand payment status','Browse the payment status and receipt information screens.'],['Stay informed','Find updates, records and guidance in one place.']]},
 bn:{brand:'ট্যাক্সপে',subtitle:'স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস',heading:'স্বাগতম',intro:'আপনার ওয়ার্কস্পেসে প্রবেশ করতে সাইন ইন করুন।',id:'ইউজার আইডি',idHint:'ইউজার আইডি লিখুন',pw:'পাসওয়ার্ড',pwHint:'পাসওয়ার্ড লিখুন',remember:'মনে রাখুন',forgot:'পাসওয়ার্ড ভুলে গেছেন?',submit:'সাইন ইন',help:'সহায়িকা',demoButton:'ট্যাক্সপে দেখুন',guideTitle:'সহায়িকা',guideCopy:'অ্যাক্সেস সংক্রান্ত তথ্যের জন্য প্রকল্প প্রশাসকের সাথে যোগাযোগ করুন।',guideClose:'বন্ধ করুন',slides:[['কর পরিশোধের ধাপ দেখুন','কর পরিশোধের প্রক্রিয়া ও প্রয়োজনীয় তথ্য দেখুন।'],['পরিশোধের অবস্থা বুঝুন','পরিশোধের অবস্থা ও রসিদের তথ্য দেখুন।'],['তথ্য জানুন','রেকর্ড, নির্দেশিকা ও আপডেট এক জায়গায় দেখুন।']]}
} as const;
const IMAGES=['office-auth/office-slide-file-returns.jpg','office-auth/office-slide-track-approvals.jpg','office-auth/office-slide-stay-updated.jpg'];

function OfficeSourceLogin(){
 const {language,setLanguage,navigate}=useTaxState();
 const t=STRINGS[language==='bn'?'bn':'en'];
 const [helpOpen,setHelpOpen]=useState(false);
 const slides=t.slides.map((item,i)=>({headline:item[0],text:item[1],image:`${import.meta.env.BASE_URL}${IMAGES[i]}`}));
 return <main className="office-auth" aria-label="TaxPay office login">
  <div className="office-auth-layout">
   <section className="login-brand-panel" aria-label="TaxPay introduction"><OfficeSourceLoginSlider slides={slides}/></section>
   <section className="login-form-wrapper">
    <div className="login-form-brand-row">
     <div className="login-form-brand-copy"><h2 className="login-form-brand-title">{t.brand}</h2><p className="login-form-brand-subtitle">{t.subtitle}</p></div>
     <div className="office-auth-brand-mark" aria-label="Independent TaxPay logo"><Landmark size={27} aria-hidden="true"/></div>
    </div>
    <div className="login-form-card">
     <div className="office-auth-form-content">
      <div className="office-auth-title-row"><div><h1 className="office-auth-title">{t.heading}</h1><p className="office-auth-subtitle">{t.intro}</p></div><button type="button" className="login-form-manual-btn" onClick={()=>setHelpOpen(true)}><BookOpen size={16} aria-hidden="true"/><span>{t.help}</span></button></div>
      <div className="office-auth-fields">
       <div><label className="login-form-label" htmlFor="office-login-user-id">{t.id}</label><input className="login-form-input" id="office-login-user-id" placeholder={t.idHint} autoComplete="off" disabled/></div>
       <div><label className="login-form-label" htmlFor="office-login-password">{t.pw}</label><input className="login-form-input" id="office-login-password" type="password" placeholder={t.pwHint} autoComplete="off" disabled/></div>
       <div className="office-auth-form-meta"><label className="office-auth-remember"><input type="checkbox" disabled/> <span>{t.remember}</span></label><button type="button" className="login-form-link" onClick={()=>setHelpOpen(true)}>{t.forgot}</button></div>
       <button type="button" className="login-form-submit" disabled>{t.submit}</button>
      </div>
     </div>
    </div>
    <div className="login-public-access"><button type="button" className="login-public-access__btn" onClick={()=>navigate('landing')}><Globe2 size={16} aria-hidden="true"/>{t.demoButton}</button></div>
    <div className="office-auth-language" role="group" aria-label="Language"><button type="button" onClick={()=>setLanguage('en')} aria-pressed={language==='en'}>EN</button><button type="button" onClick={()=>setLanguage('bn')} aria-pressed={language==='bn'}>বাংলা</button></div>
   </section>
  </div>
  <OfficeModal open={helpOpen} title={t.guideTitle} onClose={()=>setHelpOpen(false)} footer={<OfficeButton onClick={()=>setHelpOpen(false)}>{t.guideClose}</OfficeButton>}><p>{t.guideCopy}</p></OfficeModal>
 </main>;
}
export function OfficeLoginPage(){return <OfficeThemeProvider><OfficeSourceLogin/></OfficeThemeProvider>}
