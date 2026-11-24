import React from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, FileCheck2, FilePenLine, History, Plane, Repeat2, Save, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import {useTaxState} from '../../services/taxState';
import {useAccountIdentity} from '../../services/accountIdentity';
import './home2.css';

type Props={hero:React.ReactNode;recordSearch:React.ReactNode};
export function Home2Layout({hero,recordSearch}:Props){
  const {language,navigate,openAllTaxPayments,openPaymentServiceChoice,previewAccount}=useTaxState();
  const {user}=useAccountIdentity();
  const signedIn=Boolean(user||previewAccount);
  const t=(en:string,bn:string)=>language==='bn'?bn:en;
  const services=[
    {id:'corrections',Icon:FilePenLine,title:t('Corrections & Requests','সংশোধন ও আবেদন'),desc:t('Request and track','আবেদন ও অগ্রগতি'),route:'corrections'},
    {id:'history',Icon:History,title:t('Payment History','পেমেন্টের ইতিহাস'),desc:t('Past transactions','আগের লেনদেন'),route:'history'},
    {id:'again',Icon:Repeat2,title:t('Pay Again','আবার পরিশোধ'),desc:t('Reuse a past payment','আগের পেমেন্ট আবার করুন'),route:'history'},
    {id:'drafts',Icon:Save,title:t('Saved Drafts','সংরক্ষিত খসড়া'),desc:t('Resume a saved payment','খসড়া থেকে চালিয়ে যান'),route:'taxpayer_home'},
  ];
  return <div className={'home2-root'+(language==='bn'?' font-bengali':'')} data-testid="home2-root">
    <header className="home2-intro">
      <div><h1>{t('Taxes, made simpler.','কর প্রদান, এখন আরও সহজ।')}</h1><p>{t('Pay, access and manage your tax records — all in one place.','কর পরিশোধ ও কর সংক্রান্ত তথ্য এক জায়গায়।')}</p></div>
      <span className="home2-guest"><ShieldCheck size={18} aria-hidden="true"/>{t('Guest payments available','সাইন ইন ছাড়াও কর পরিশোধ করুন')}</span>
    </header>
    <div className="home2-grid">
      <section className="home2-tile home2-pay">
        <div className="home2-label"><span>{t('01 / PAYMENTS','০১ / কর পরিশোধ')}</span><WalletCards size={25} aria-hidden="true"/></div>
        <h2>{t('Pay Tax','কর পরিশোধ')}</h2><p>{t('For yourself, your family or your clients.','নিজের, পরিবারের বা ক্লায়েন্টের কর পরিশোধ করুন।')}</p>
        <svg className="home2-pay-art" viewBox="0 0 300 180" aria-hidden="true"><circle cx="151" cy="88" r="84" fill="#3657d4"/><circle cx="151" cy="88" r="68" stroke="#6c83e8" fill="none"/><circle cx="151" cy="88" r="52" stroke="#6c83e8" fill="none"/><ellipse cx="153" cy="158" rx="85" ry="9" fill="#203bb0"/><g transform="rotate(11 171 88)"><rect x="115" y="23" width="112" height="128" rx="12" fill="#8297f2"/><path d="M135 43H204M135 53H184" stroke="#c0ccff" strokeWidth="4" strokeLinecap="round"/></g><g transform="rotate(-12 132 83)"><rect x="76" y="15" width="113" height="134" rx="12" fill="#f8faff"/><rect x="91" y="30" width="36" height="7" rx="3" fill="#294acb"/><path d="M91 47H171M91 56H149" stroke="#c4d0eb" strokeWidth="3" strokeLinecap="round"/><rect x="91" y="68" width="83" height="47" rx="8" fill="#e4eaff"/><text x="132" y="103" textAnchor="middle" fontSize="38" fill="#294acb" fontWeight="600">৳</text><path d="M91 130H162" stroke="#c4d0eb" strokeWidth="3" strokeLinecap="round"/></g><circle cx="213" cy="127" r="29" fill="#ddf1b5" stroke="#294acb" strokeWidth="4"/><path d="M200 127L209 136L226 117" stroke="#254635" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div className="home2-tags"><span>{t('Tax with Return','রিটার্নের সঙ্গে কর')}</span><span>{t('Other Tax','অন্যান্য কর')}</span></div>
        <button type="button" className="home2-main-action" data-testid="home2-pay" onClick={openAllTaxPayments}>{t('Start tax payment','কর পরিশোধ শুরু করুন')}<ArrowRight size={20} aria-hidden="true"/></button>
      </section>
      <section className="home2-tile home2-travel">
        <div className="home2-label"><span>{t('02 / TRAVEL','০২ / ভ্রমণ')}</span><Plane size={24} aria-hidden="true"/></div>
        <div className="home2-media-row"><div><h2>{t('Travel Tax','ভ্রমণ কর')}</h2><p>{t('One less thing before your next journey.','যাত্রার আগে ভ্রমণ কর পরিশোধ করুন।')}</p><button type="button" className="home2-text-action" data-testid="home2-travel" onClick={()=>openPaymentServiceChoice('TRAVEL_TAX')}>{t('Pay travel tax','ভ্রমণ কর পরিশোধ')}<ArrowRight size={18} aria-hidden="true"/></button></div>
        <svg viewBox="0 0 155 125" aria-hidden="true"><circle cx="79" cy="64" r="56" fill="#c4dbc2"/><circle cx="79" cy="64" r="43" stroke="#a3c2a6" fill="none"/><path d="M10 86Q77 0 148 91" stroke="#8bab91" strokeDasharray="4 5" fill="none"/><g transform="rotate(-12 58 64)"><rect x="28" y="22" width="57" height="87" rx="6" fill="#28553c"/><rect x="32" y="25" width="49" height="80" rx="3" stroke="#568769" fill="none"/><path d="M40 37H73" stroke="#ddebd9" strokeWidth="3" strokeLinecap="round"/><circle cx="57" cy="61" r="14" stroke="#c4dbc2" fill="none"/><ellipse cx="57" cy="61" rx="6" ry="14" stroke="#c4dbc2" fill="none"/><path d="M43 61H71M46 54H68M46 68H68M45 87H69" stroke="#c4dbc2" fill="none"/></g><path d="M69 47L142 16L117 86L101 64L81 75L87 55Z" fill="#fff" stroke="#28553c" strokeWidth="1.6" strokeLinejoin="round"/><path d="M101 64L142 16L87 55" stroke="#28553c" strokeWidth="1.3" fill="none"/></svg></div>
      </section>
      <div className="home2-tile home2-record"><div className="home2-label">{t('03 / PAYMENT RECORDS','০৩ / পেমেন্ট রেকর্ড')}</div>{recordSearch}</div>
      <section className="home2-tile home2-cert"><div className="home2-label"><span>{t('04 / DOCUMENTS','০৪ / সনদ')}</span><FileCheck2 size={24} aria-hidden="true"/></div><div className="home2-media-row"><div><h2>{t('Tax Certificates','কর সনদ')}</h2><p>{t('Your proof of payment, whenever you need it.','প্রয়োজনের সময় পেমেন্টের প্রমাণপত্র পান।')}</p><button className="home2-text-action" type="button" onClick={()=>navigate(signedIn?'certificates':'verify',{fromHome2:true})}>{t('View certificates','সনদ দেখুন')}<ArrowRight size={18} aria-hidden="true"/></button></div>
      <svg viewBox="0 0 150 110" aria-hidden="true"><circle cx="78" cy="56" r="52" fill="#d5dbf1"/><g transform="rotate(10 91 54)"><rect x="53" y="13" width="76" height="84" rx="5" fill="#a9b7db"/></g><g transform="rotate(-9 65 51)"><rect x="21" y="6" width="85" height="92" rx="5" fill="#fff" stroke="#a4b1d3"/><rect x="28" y="13" width="71" height="78" rx="2" fill="none" stroke="#d0d8ed"/><path d="M43 25H84" stroke="#4f6397" strokeWidth="4" strokeLinecap="round"/><path d="M38 38H90M38 45H85M44 52H80" stroke="#b9c5df" strokeWidth="3" strokeLinecap="round"/><path d="M57 71L52 91L64 85L76 91L72 71" fill="#294acb"/><circle cx="65" cy="70" r="14" fill="#e2ba6b"/></g></svg></div></section>
      {services.map(({id,Icon,title,desc,route})=><button key={id} type="button" className={'home2-tile home2-small home2-'+id} data-testid={'home2-'+id} onClick={()=>navigate(route,{fromHome2:true})}><div className="home2-small-top"><span className="home2-icon"><Icon size={22} aria-hidden="true"/></span><ArrowUpRight size={18} aria-hidden="true"/></div><span className="home2-small-title">{title}</span><span className="home2-small-desc">{desc}</span>{!signedIn&&<span className="home2-auth-hint">{t('Sign in required','সাইন ইন প্রয়োজন')}</span>}</button>)}
      <section className="home2-tile home2-account"><div className="home2-label"><span>{t('YOUR PERSONAL SPACE','আপনার ব্যক্তিগত তথ্য')}</span><UserRound size={24} aria-hidden="true"/></div><h2>{t('My tax account','আমার কর অ্যাকাউন্ট')}</h2><p>{t('Your personal tax records, together.','আপনার কর সংক্রান্ত তথ্য এক জায়গায়।')}</p><button type="button" className="home2-text-action" onClick={()=>navigate(signedIn?'taxpayer_home':'taxpayer_login',{fromHome2:true})}>{signedIn?t('Open dashboard','ড্যাশবোর্ড দেখুন'):t('Sign in to your account','অ্যাকাউন্টে সাইন ইন করুন')}<ArrowRight size={18} aria-hidden="true"/></button>{signedIn&&<button type="button" className="home2-text-action" onClick={()=>navigate('beneficiaries')}>{t('Manage beneficiaries','সুবিধাভোগী পরিচালনা')}<ArrowRight size={18} aria-hidden="true"/></button>}</section>
      <section className="home2-cms" aria-label={t('Discover Sohojkor','সহজকর সম্পর্কে জানুন')}>{hero}</section>
      <section className="home2-tile home2-help"><BookOpen size={28} aria-hidden="true"/><h2>{t('Need help?','সহায়তা প্রয়োজন?')}</h2><p>{t('Explore the existing taxpayer guide.','করদাতার নির্দেশিকা দেখুন।')}</p><button type="button" className="home2-text-action" onClick={()=>navigate('user_guide')}>{t('User guide','ব্যবহার নির্দেশিকা')}<ArrowRight size={18} aria-hidden="true"/></button></section>
    </div>
  </div>;
}
