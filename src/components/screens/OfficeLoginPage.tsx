import React, {useEffect, useState} from 'react';
import {BookOpen, Globe2, Landmark} from 'lucide-react';
import {sampleJourneysEnabled,useTaxState} from '../../services/taxState';
import {getDemoUser} from '../../data/demoUsers';
import {useAccountIdentity} from '../../services/accountIdentity';
import {supabase} from '../../services/supabaseClient';
import {authRedirectUrl} from '../../services/secureWorkspacePolicy';
import {configureLoginPersistence} from '../../services/taxpayAuthStorage';
import {OfficeThemeProvider} from '../office-ui/OfficeTheme';
import {OfficeSourceLoginSlider} from '../office-ui/auth/OfficeSourceLoginSlider';
import {OfficeModal, OfficeButton} from '../office-ui/OfficeControls';
import { taxpayerBrandName } from '../../config/brand';

// Layout, login hierarchy, copy positions, image carousel and controls are
// source-grounded in OfficeManagement/LoginPage, LoginForm and LoginSlider.
// TaxPay has independent authentication; never borrow an Office Management session.
const STRINGS={
 en:{brand:'Korbritto',subtitle:'Tax Payment Workspace',heading:'Welcome back',intro:'Sign in to access your workspace.',id:'User ID or email',idHint:'user1 or your account email',pw:'Password',pwHint:'Enter your password',remember:'Remember me',forgot:'Forgot password?',submit:'Sign in',help:'Help & User Guide',demoButton:'Back to Korbritto',guideTitle:'Help & User Guide',guideCopy:'Use user1–user10 without a password to explore an example account. For your own account, enter its email address and password.',guideClose:'Close',preview:'Example account access: user1–user10 · no password needed',missingEmail:'Enter your account email address to continue.',missingPassword:'Enter your password.',authUnavailable:'Account sign-in is unavailable right now. Please try again later.',invalidCredentials:'Sign-in failed. Check your email and password.',recoverySent:'If an account exists for this email, password reset instructions will arrive by email.',recoveryFailed:'Could not send the reset email. Please try again.',reset:'Set new password',resetConfirm:'Save new password',resetDone:'Password updated. Your account is ready.',resetFailed:'Could not update your password. Please retry.',signedIn:'You are signed in.',continue:'Open my dashboard',slides:[['Review payment steps','Find the payment workflow and supporting information.'],['Understand payment status','Browse the payment status and receipt information screens.'],['Stay informed','Find updates, records and guidance in one place.']]},
 bn:{brand:'করবৃত্ত',subtitle:'কর পরিশোধ ওয়ার্কস্পেস',heading:'স্বাগতম',intro:'আপনার ওয়ার্কস্পেসে প্রবেশ করতে সাইন ইন করুন।',id:'ইউজার আইডি বা ইমেইল',idHint:'user1 অথবা অ্যাকাউন্ট ইমেইল',pw:'পাসওয়ার্ড',pwHint:'পাসওয়ার্ড লিখুন',remember:'মনে রাখুন',forgot:'পাসওয়ার্ড ভুলে গেছেন?',submit:'সাইন ইন',help:'সহায়িকা',demoButton:'করবৃত্তে ফিরুন',guideTitle:'সহায়িকা',guideCopy:'নমুনা অ্যাকাউন্ট দেখতে পাসওয়ার্ড ছাড়াই user1–user10 লিখুন। নিজের অ্যাকাউন্টের জন্য ইমেইল ও পাসওয়ার্ড দিন।',guideClose:'বন্ধ করুন',preview:'অ্যাকাউন্টের উদাহরণ: user1–user10 · পাসওয়ার্ড লাগবে না',missingEmail:'অ্যাকাউন্টের ইমেইল ঠিকানা লিখুন।',missingPassword:'পাসওয়ার্ড লিখুন।',authUnavailable:'অ্যাকাউন্টে সাইন ইন আপাতত সম্ভব নয়। পরে চেষ্টা করুন।',invalidCredentials:'সাইন ইন ব্যর্থ। ইমেইল ও পাসওয়ার্ড যাচাই করুন।',recoverySent:'এই ইমেইলে অ্যাকাউন্ট থাকলে পাসওয়ার্ড বদলের নির্দেশনা পাঠানো হবে।',recoveryFailed:'পাসওয়ার্ড বদলের ইমেইল পাঠানো যায়নি। আবার চেষ্টা করুন।',reset:'নতুন পাসওয়ার্ড দিন',resetConfirm:'নতুন পাসওয়ার্ড সংরক্ষণ',resetDone:'পাসওয়ার্ড পরিবর্তন হয়েছে। অ্যাকাউন্ট প্রস্তুত।',resetFailed:'পাসওয়ার্ড পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।',signedIn:'আপনি সাইন ইন করেছেন।',continue:'আমার ড্যাশবোর্ড খুলুন',slides:[['কর পরিশোধের ধাপ দেখুন','কর পরিশোধের প্রক্রিয়া ও প্রয়োজনীয় তথ্য দেখুন।'],['পরিশোধের অবস্থা বুঝুন','পরিশোধের অবস্থা ও রসিদের তথ্য দেখুন।'],['তথ্য জানুন','রেকর্ড, নির্দেশিকা ও আপডেট এক জায়গায় দেখুন।']]}
} as const;
const IMAGES=['office-auth/office-slide-file-returns.jpg','office-auth/office-slide-track-approvals.jpg','office-auth/office-slide-stay-updated.jpg'];

function OfficeSourceLogin(){
 const {language,setLanguage,navigate,setUserRole}=useTaxState();
 const t=STRINGS[language==='bn'?'bn':'en'];
 const [helpOpen,setHelpOpen]=useState(false);
 const [loginId,setLoginId]=useState('');
 const [password,setPassword]=useState('');
 const [remember,setRemember]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{error:boolean;text:string}|null>(null);
 const [recoveryMode,setRecoveryMode]=useState(()=>new URLSearchParams(window.location.search).get('reset')==='1');
 const {user,loading}=useAccountIdentity();
 // Fictional, password-free sample identities are for local UX review only.
 // Published sign-in must never present them as real account access.
 const previewUser=sampleJourneysEnabled?getDemoUser(loginId.trim().toLowerCase()):null;
 const loginLabel=sampleJourneysEnabled?t.id:(language==='bn'?'অ্যাকাউন্ট ইমেইল':'Account email address');
 const loginHint=sampleJourneysEnabled?t.idHint:(language==='bn'?'অ্যাকাউন্ট ইমেইল':'Account email');
 const guideCopy=sampleJourneysEnabled?t.guideCopy:(language==='bn'?'আপনার অ্যাকাউন্ট ইমেইল ও পাসওয়ার্ড লিখুন। পাসওয়ার্ড ভুলে গেলে রিসেট লিংক ব্যবহার করুন।':'Enter your account email and password. Use the password reset link if you cannot sign in.');
 const slides=t.slides.map((item,i)=>({headline:item[0],text:item[1],image:`${import.meta.env.BASE_URL}${IMAGES[i]}`}));
 useEffect(()=>{
  const {data}=supabase?.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY')setRecoveryMode(true);
  })??{data:null};
  return()=>data?.subscription.unsubscribe();
 },[]);
 const signIn=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(busy)return;
  setMessage(null);
  if(user){navigate('taxpayer_home');return;}
  if(previewUser){
    const url=new URL(import.meta.env.BASE_URL,window.location.origin);
    url.searchParams.set('action','taxpayer_home');
    url.searchParams.set('demoUser',previewUser.id);
    if(language==='bn')url.searchParams.set('lang','bn');
    window.location.assign(url.toString());
    return;
  }
  if(!loginId.trim()||!loginId.includes('@')){setMessage({error:true,text:t.missingEmail});return;}
  if(!password){setMessage({error:true,text:t.missingPassword});return;}
  if(!supabase){setMessage({error:true,text:t.authUnavailable});return;}
  setBusy(true);
  try{
    configureLoginPersistence(remember);
    const {data,error}=await supabase.auth.signInWithPassword({email:loginId.trim(),password});
    if(error||!data.session?.user){setMessage({error:true,text:t.invalidCredentials});return;}
    setPassword('');
    setUserRole('GUEST');
    navigate('taxpayer_home');
  }catch{setMessage({error:true,text:t.authUnavailable});}
  finally{setBusy(false);}
 };
 const requestReset=async()=>{
  if(busy)return;
  if(!loginId.trim().includes('@')){setMessage({error:true,text:t.missingEmail});return;}
  if(!supabase){setMessage({error:true,text:t.authUnavailable});return;}
  setBusy(true);setMessage(null);
  try{
    const redirect=new URL(authRedirectUrl(window.location.origin,import.meta.env.BASE_URL));
    redirect.searchParams.set('action','office_login');redirect.searchParams.set('reset','1');
    const {error}=await supabase.auth.resetPasswordForEmail(loginId.trim(),{redirectTo:redirect.toString()});
    setMessage({error:Boolean(error),text:error?t.recoveryFailed:t.recoverySent});
  }catch{setMessage({error:true,text:t.recoveryFailed});}
  finally{setBusy(false);}
 };
 const updatePassword=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!user||!supabase){setMessage({error:true,text:t.authUnavailable});return;}
  if(password.length<8){setMessage({error:true,text:language==='bn'?'অন্তত ৮ অক্ষরের পাসওয়ার্ড দিন।':'Use a password with at least 8 characters.'});return;}
  setBusy(true);setMessage(null);
  try{
    const {error}=await supabase.auth.updateUser({password});
    if(error){setMessage({error:true,text:t.resetFailed});return;}
    setPassword('');setRecoveryMode(false);
    const url=new URL(window.location.href);url.searchParams.delete('reset');
    window.history.replaceState(window.history.state,'',url.toString());
    navigate('taxpayer_home');
  }catch{setMessage({error:true,text:t.resetFailed});}
  finally{setBusy(false);}
 };
 return <main className="office-auth" aria-label={language==='bn'?'করবৃত্ত লগইন':'Korbritto sign in'}>
  <div className="office-auth-layout">
   <section className="login-brand-panel" aria-label={language==='bn'?'করবৃত্ত পরিচিতি':'Korbritto introduction'}><OfficeSourceLoginSlider slides={slides}/></section>
   <section className="login-form-wrapper">
    <div className="login-form-brand-row">
     <div className="login-form-brand-copy"><h2 className="login-form-brand-title">{taxpayerBrandName(language)}</h2><p className="login-form-brand-subtitle">{t.subtitle}</p></div>
     <div className="office-auth-brand-mark" aria-label={language==='bn'?'করবৃত্ত লোগো':'Korbritto logo'}><Landmark size={27} aria-hidden="true"/></div>
    </div>
    <div className="login-form-card">
     <div className="office-auth-form-content">
      <div className="office-auth-title-row"><div><h1 className="office-auth-title">{t.heading}</h1><p className="office-auth-subtitle">{t.intro}</p></div><button type="button" className="login-form-manual-btn" onClick={()=>setHelpOpen(true)}><BookOpen size={16} aria-hidden="true"/><span>{t.help}</span></button></div>
      <form className="office-auth-fields" onSubmit={recoveryMode?updatePassword:signIn} noValidate>
       {(!user&&!recoveryMode)&&<div><label className="login-form-label" htmlFor="office-login-user-id">{loginLabel}</label><input className="login-form-input" id="office-login-user-id" placeholder={loginHint} autoComplete="username" autoCapitalize="none" spellCheck={false} value={loginId} onChange={event=>setLoginId(event.target.value)} disabled={busy||loading}/></div>}
       {(!user||recoveryMode)&&<div><label className="login-form-label" htmlFor="office-login-password">{recoveryMode?t.reset:t.pw}</label><input className="login-form-input" id="office-login-password" type="password" minLength={recoveryMode?8:undefined} placeholder={t.pwHint} autoComplete={recoveryMode?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy||loading||(!recoveryMode&&Boolean(previewUser))}/></div>}
       {!user&&!recoveryMode&&<><div className="office-auth-form-meta"><label className="office-auth-remember"><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)} disabled={busy||loading}/> <span>{t.remember}</span></label><button type="button" className="login-form-link" onClick={requestReset} disabled={busy||loading}>{t.forgot}</button></div>{sampleJourneysEnabled&&<p className="text-xs text-slate-600" id="taxpay-id-help">{t.preview}</p>}</>}
       <button type="submit" className="login-form-submit" disabled={busy||loading}>{user&&!recoveryMode?t.continue:recoveryMode?t.resetConfirm:t.submit}</button>
       {user&&!recoveryMode&&<p role="status" className="text-sm text-slate-600">{t.signedIn}</p>}
       {message&&<p role={message.error?'alert':'status'} className={`office-login-feedback ${message.error?'text-red-700':'text-blue-800'}`}>{message.text}</p>}
      </form>
     </div>
    </div>
    <div className="login-public-access"><button type="button" className="login-public-access__btn" onClick={()=>navigate('landing')}><Globe2 size={16} aria-hidden="true"/>{language==='bn'?'করবৃত্ত-এ ফিরুন':'Back to Korbritto'}</button></div>
    <div className="office-auth-language" role="group" aria-label="Language"><button type="button" onClick={()=>setLanguage('en')} aria-pressed={language==='en'}>EN</button><button type="button" onClick={()=>setLanguage('bn')} aria-pressed={language==='bn'}>বাংলা</button></div>
   </section>
  </div>
  <OfficeModal open={helpOpen} title={t.guideTitle} onClose={()=>setHelpOpen(false)} footer={<OfficeButton onClick={()=>setHelpOpen(false)}>{t.guideClose}</OfficeButton>}><p>{guideCopy}</p></OfficeModal>
 </main>;
}
export function OfficeLoginPage(){return <OfficeThemeProvider><OfficeSourceLogin/></OfficeThemeProvider>}
