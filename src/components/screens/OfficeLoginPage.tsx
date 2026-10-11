import React,{useEffect,useState} from 'react';
import {BookOpen,Globe,Landmark} from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {OfficeThemeProvider} from '../office-ui/OfficeTheme';
import {OfficeModal,OfficeButton} from '../office-ui/OfficeControls';
import {LoginBrandPanel} from '../office-ui/auth/LoginBrandPanel';
import {AppTextField} from '../office-ui/forms/AppTextField';
import {AppPasswordField} from '../office-ui/forms/AppPasswordField';
import {AppCheckbox} from '../office-ui/forms/AppCheckbox';

/** Port of NBR Office Management src/app/pages/auth/LoginPage.tsx and
 * src/app/components/auth/LoginForm.tsx from commit 8a9523277e99f01a8af31294119d8e337f2edf74.
 * Three slide components and the original PNG artwork are copied unchanged.
 * Exceptions: TaxPay identity in place of NBR branding; auth remains gated/disabled;
 * Source MUI form controls and matching dependency versions are now retained.
 */
const CONTENT={
 en:{title:'TaxPay',subtitle:'Tax Payment Workspace',welcome:'Welcome back',intro:'Sign in to access your office workspace.',userId:'User ID',userIdPlaceholder:'Enter your User ID',password:'Password',passwordPlaceholder:'Enter your password',rememberMe:'Remember me',forgot:'Forgot password?',signIn:'Sign in',userManual:'Help & User Guide',needHelp:'Need help? Contact your system administrator.',publicHelper:'Browse the TaxPay public pages without an account.',publicButton:'Explore TaxPay',helpTitle:'Help & User Guide',helpCopy:'Contact the project administrator for account access.',close:'Close',slides:[['File Returns Online','Explore return records and related services in one place.'],['Track Approvals Faster','Follow pending and completed workflow items with clear status updates.'],['Stay Updated','Find important notices, system updates and tax information.']]},
 bn:{title:'ট্যাক্সপে',subtitle:'কর পরিশোধ ওয়ার্কস্পেস',welcome:'স্বাগতম',intro:'আপনার অফিস ড্যাশবোর্ড অ্যাক্সেস করতে সাইন ইন করুন।',userId:'ব্যবহারকারী আইডি',userIdPlaceholder:'আপনার ব্যবহারকারী আইডি লিখুন',password:'পাসওয়ার্ড',passwordPlaceholder:'আপনার পাসওয়ার্ড লিখুন',rememberMe:'মনে রাখুন',forgot:'পাসওয়ার্ড ভুলে গেছেন?',signIn:'সাইন ইন',userManual:'সহায়তা ও নির্দেশিকা',needHelp:'সাহায্য প্রয়োজন? আপনার সিস্টেম অ্যাডমিনিস্ট্রেটরের সাথে যোগাযোগ করুন।',publicHelper:'অ্যাকাউন্ট ছাড়াই ট্যাক্সপে-এর প্রকাশ্য পৃষ্ঠাগুলো দেখুন।',publicButton:'ট্যাক্সপে দেখুন',helpTitle:'সহায়িকা',helpCopy:'অ্যাকাউন্ট অ্যাক্সেসের জন্য প্রকল্প প্রশাসকের সাথে যোগাযোগ করুন।',close:'বন্ধ করুন',slides:[['অনলাইনে রিটার্ন ফাইল করুন','রিটার্ন রেকর্ড ও সংশ্লিষ্ট সেবার তথ্য এক জায়গায় দেখুন।'],['দ্রুত অনুমোদন ট্র্যাক করুন','অপেক্ষমান ও সম্পন্ন কাজের অবস্থা দেখুন।'],['আপডেট থাকুন','গুরুত্বপূর্ণ নোটিশ, সিস্টেম আপডেট ও কর সংক্রান্ত তথ্য দেখুন।']]}
} as const;
const IMAGES=['office-slide-file-returns.png','office-slide-track-approvals.png','office-slide-stay-updated.png'];

function SourceLogin(){
 const {language,setLanguage,navigate}=useTaxState();
 const text=CONTENT[language==='bn'?'bn':'en'];
 const [isDesktop,setIsDesktop]=useState(()=>typeof window!=='undefined' && window.innerWidth>=1024);
 const [helpOpen,setHelpOpen]=useState(false);
 useEffect(()=>{const resize=()=>setIsDesktop(window.innerWidth>=1024);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[]);
 const slides=text.slides.map((item,i)=>({headline:item[0],text:item[1],image:`${import.meta.env.BASE_URL}office-auth/${IMAGES[i]}`}));
 return <main className="office-auth office-auth-clone" aria-label="TaxPay office login">
   <div className="office-auth-layout">
     {isDesktop&&<LoginBrandPanel slides={slides}/>}
     <div className={'login-form-wrapper'+(!isDesktop?' login-form-wrapper--mobile':'')}>
       <div className="login-form-brand-row">
         <div className="flex-1 min-w-0"><h2 className="login-form-brand-title">{text.title}</h2><p className="login-form-brand-subtitle">{text.subtitle}</p></div>
         <div className="office-source-brand-logo" aria-label="TaxPay logo"><div className="office-source-brand-logo__inner"><Landmark size={32} aria-hidden="true"/><span>TaxPay</span></div></div>
       </div>
       <div className={'login-form-card modal-enter'+(!isDesktop?' login-form-card--mobile':'')}>
         <div className="flex flex-col gap-6">
           <div className="flex items-start justify-between gap-4 flex-wrap">
             <div className="flex-1 min-w-0"><h1 className="modal-form-header__title text-[30px] mb-1">{text.welcome}</h1><p className="modal-form-header__subtitle">{text.intro}</p></div>
             <button type="button" className="login-form-manual-btn" onClick={()=>setHelpOpen(true)}><BookOpen size={12} aria-hidden="true"/><span className="text-[14px]">{text.userManual}</span></button>
           </div>
           <div className="flex flex-col gap-5">
             <AppTextField id="login-user-id" label={text.userId} value="" onChange={()=>{}} placeholder={text.userIdPlaceholder} disabled/>
             <AppPasswordField id="login-password" label={text.password} value="" onChange={()=>{}} placeholder={text.passwordPlaceholder} disabled/>
             <div className="flex items-center justify-between gap-4 flex-wrap">
               <AppCheckbox id="login-remember-me" label={text.rememberMe} checked={false} onChange={()=>{}} disabled/>
               <button type="button" onClick={()=>setHelpOpen(true)} className="login-form-link">{text.forgot}</button>
             </div>
             <button type="button" disabled className="login-form-submit"><span>{text.signIn}</span></button>
             <p className="text-[13px] text-center text-[var(--color-text-secondary)]">{text.needHelp}</p>
           </div>
         </div>
       </div>
       <div className="login-public-access"><p className="login-public-access__text">{text.publicHelper}</p>
         <button type="button" className="login-public-access__btn" onClick={()=>navigate('landing')}><Globe size={16} aria-hidden="true"/>{text.publicButton}</button>
       </div>
       <div className="office-source-language" role="group" aria-label="Language"><button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button><button type="button" aria-pressed={language==='bn'} onClick={()=>setLanguage('bn')}>বাংলা</button></div>
     </div>
   </div>
   <OfficeModal open={helpOpen} title={text.helpTitle} onClose={()=>setHelpOpen(false)} footer={<OfficeButton onClick={()=>setHelpOpen(false)}>{text.close}</OfficeButton>}><p>{text.helpCopy}</p></OfficeModal>
 </main>;
}
export function OfficeLoginPage(){return <OfficeThemeProvider><SourceLogin/></OfficeThemeProvider>}
