import React, {useState} from 'react';
import {ArrowLeft, ShieldCheck, LockKeyhole, ChevronLeft, ChevronRight} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {OfficeThemeProvider, useOfficeTheme, officeThemeIds, officeFonts, type OfficeFontSize} from '../office-ui/OfficeTheme';
import {THEMES} from '../office-ui/themes';
import {OfficeAlert, OfficeButton, OfficeCheckbox, OfficeInput, OfficePasswordField, OfficeSelect} from '../office-ui/OfficeControls';

const CONTENT={
  en:{title:'TaxPay Office Login',subtitle:'Office Management design — independent demonstration',heading:'Sign in',intro:'This login design is adapted from Office Management. Real account sign-in is not configured; explore the public demo without signing in.',id:'User ID',pw:'Password',remember:'Remember me',forgot:'Forgot password?',submit:'Sign in',return:'Explore TaxPay Demo',demo:'Demonstration only. Do not enter real passwords or taxpayer details.',themes:'Appearance theme',fonts:'Typography',size:'Text size',slides:[['A consistent workspace','Shared navigation, reusable inputs and unified layouts across TaxPay.'],['Accessible from any device','Responsive forms, keyboard focus and EN/BN-friendly typography.'],['Verified workflows come first','Tax payments and official authentication remain unavailable until authorized and tested.']]},
  bn:{title:'ট্যাক্সপে অফিস লগইন',subtitle:'অফিস ম্যানেজমেন্ট ডিজাইন — স্বতন্ত্র প্রদর্শনী',heading:'সাইন ইন',intro:'অফিস ম্যানেজমেন্টের লগইন নকশা এখানে দেখানো হয়েছে। প্রকৃত পরিচয় যাচাই এখনো সক্রিয় নয়।',id:'ইউজার আইডি',pw:'পাসওয়ার্ড',remember:'মনে রাখুন',forgot:'পাসওয়ার্ড ভুলে গেছেন?',submit:'সাইন ইন',return:'ট্যাক্সপে ডেমো দেখুন',demo:'শুধু প্রদর্শনীর জন্য। প্রকৃত পাসওয়ার্ড বা করদাতার তথ্য লিখবেন না।',themes:'রঙের থিম',fonts:'ফন্ট',size:'অক্ষরের আকার',slides:[['একটি সমন্বিত ওয়ার্কস্পেস','ট্যাক্সপে-তে অভিন্ন নেভিগেশন, ফর্ম ও ডিজাইন উপাদান।'],['যেকোনো ডিভাইসে ব্যবহারযোগ্য','মোবাইল উপযোগী ফর্ম, কিবোর্ড ফোকাস ও বাংলা-ইংরেজি ফন্ট।'],['যাচাইকৃত কাজ আগে','অনুমোদন ও পরীক্ষা ছাড়া প্রকৃত কর পরিশোধ ও লগইন সক্রিয় করা হবে না।']]}
} as const;

function OfficeLoginContent(){
  const {language,setLanguage,navigate}=useTaxState();const {theme,setTheme,font,setFont,size,setSize}=useOfficeTheme();
  const [slide,setSlide]=useState(0);const text=CONTENT[language==='bn'?'bn':'en'];
  return <main className="om-login">
    <div className="om-login-layout">
      <section className="om-login-intro" aria-label="Office Management design introduction">
        <div><div className="om-login-intro-icon"><ShieldCheck size={32} aria-hidden="true"/></div>
          <h2>{text.slides[slide][0]}</h2><p>{text.slides[slide][1]}</p></div>
        <div className="om-login-theme"><OfficeButton variant="secondary" aria-label="Previous slide" onClick={()=>setSlide(v=>(v+2)%3)}><ChevronLeft size={18}/></OfficeButton><p aria-live="polite">{slide+1} / 3</p><OfficeButton variant="secondary" aria-label="Next slide" onClick={()=>setSlide(v=>(v+1)%3)}><ChevronRight size={18}/></OfficeButton></div>
      </section>
      <section className="om-login-form-side">
        <div className="om-login-theme" role="group" aria-label={language==='bn'?'ভাষা নির্বাচন':'Language selection'}>
          <OfficeButton variant={language==='en'?'primary':'quiet'} aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</OfficeButton>
          <OfficeButton variant={language==='bn'?'primary':'quiet'} aria-pressed={language==='bn'} onClick={()=>setLanguage('bn')}>বাংলা</OfficeButton>
        </div>
        <div className="om-login-brand"><div><h2>{text.title}</h2><p>{text.subtitle}</p></div><LockKeyhole size={30} aria-hidden="true"/></div>
        <div className="om-login-form">
          <h1>{text.heading}</h1><p className="om-login-form-subtitle">{text.intro}</p>
          <div className="om-login-disclaimer"><OfficeAlert tone="warning">{text.demo}</OfficeAlert></div>
          <div className="om-login-fields">
            <OfficeInput label={text.id} placeholder={text.id} autoComplete="off" disabled hint="Authentication service not configured" />
            <OfficePasswordField label={text.pw} autoComplete="off" placeholder={text.pw} disabled />
            <div className="om-login-foot"><OfficeCheckbox label={text.remember} disabled/><OfficeButton variant="quiet" disabled>{text.forgot}</OfficeButton></div>
            <OfficeButton variant="primary" size="lg" disabled>{text.submit}</OfficeButton>
          </div>
          <p className="om-login-footer">{text.demo}</p>
        </div>
        <div className="om-login-back"><OfficeButton variant="outline" onClick={()=>navigate('landing')}><ArrowLeft size={17}/>{text.return}</OfficeButton></div>
        <div className="om-login-foot">
          <OfficeSelect label={text.themes} value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}>{officeThemeIds.map(id=><option key={id} value={id}>{THEMES[id].name}</option>)}</OfficeSelect>
          <OfficeSelect label={text.fonts} value={font} onChange={e=>setFont(e.target.value as typeof font)}>{officeFonts.map(id=><option key={id} value={id}>{id}</option>)}</OfficeSelect>
          <OfficeSelect label={text.size} value={size} onChange={e=>setSize(e.target.value as OfficeFontSize)}>{(['compact','standard','large'] as const).map(id=><option key={id} value={id}>{id}</option>)}</OfficeSelect>
        </div>
      </section>
    </div>
  </main>;
}
export function OfficeLoginPage(){return <OfficeThemeProvider><OfficeLoginContent/></OfficeThemeProvider>}
