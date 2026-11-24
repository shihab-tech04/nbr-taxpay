import React from 'react';
import {ArrowRight,ArrowUpRight,FilePenLine,History,Repeat2,Save,ScanSearch,UserRound} from 'lucide-react';
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
    {id:'corrections',Icon:FilePenLine,title:t('Need a correction?','সংশোধন প্রয়োজন?'),desc:t('Request & track','আবেদন ও অগ্রগতি'),route:'corrections'},
    {id:'history',Icon:History,title:t('Your history.','আপনার ইতিহাস।'),desc:t('Past payments & records','আগের পেমেন্ট ও রেকর্ড'),route:'history'},
    {id:'again',Icon:Repeat2,title:t('Pay again.','আবার পরিশোধ।'),desc:t('Repeat. Edit. Pay.','আবার করুন। সম্পাদনা করুন। পরিশোধ করুন।'),route:'history'},
    {id:'drafts',Icon:Save,title:t('Saved drafts.','সংরক্ষিত খসড়া।'),desc:t('Resume a payment.','খসড়া থেকে চালিয়ে যান।'),route:'taxpayer_home'},
  ];
  const small=(id:string)=>{const s=services.find(item=>item.id===id)!;return <button key={s.id} type="button" className={'home2-tile home2-small home2-'+s.id} data-testid={'home2-'+s.id} onClick={()=>navigate(s.route,{fromHome2:true})}><span className="home2-small-top"><s.Icon size={24} aria-hidden="true"/><ArrowUpRight size={16} aria-hidden="true"/></span><span className="home2-small-title">{s.title}</span><span className="home2-small-desc">{s.desc}</span></button>};
  return <div className={'home2-root'+(language==='bn'?' font-bengali':'')} data-testid="home2-root" data-design="bento-03">
    <header className="home2-intro"><h1>{t("Tax doesn't have to be complicated",'কর পরিশোধ জটিল হওয়ার প্রয়োজন নেই')}<span>.</span></h1><div className="home2-intro-mark"><span aria-hidden="true">✳</span><p>{t('Made for everyone.','সবার জন্য।')}</p></div></header>
    <div className="home2-grid">
      <section className="home2-cms" aria-label={t('Discover Sohojkor','সহজকর সম্পর্কে জানুন')}>{hero}</section>
      <section className="home2-tile home2-pay">
        <div className="home2-label"><span>{t('02 — MAKE A PAYMENT','০২ — কর পরিশোধ')}</span><span className="home2-circle-arrow"><ArrowUpRight size={22} aria-hidden="true"/></span></div>
        <div className="home2-media-row"><div><h2>{t('Pay Tax.','কর পরিশোধ।')}</h2><p>{t('All your eligible tax payments.','আপনার প্রযোজ্য সব কর পরিশোধ।')}</p><p className="home2-guest">{t('No login required to pay','কর দিতে লগইন প্রয়োজন নেই')}</p></div>
        <svg className="home2-pay-art" viewBox="0 0 130 125" aria-hidden="true"><circle cx="68" cy="64" r="60" fill="#3f5ae1"/><circle cx="68" cy="64" r="49" stroke="#6f84ee" fill="none"/><g transform="rotate(-15 62 60)"><rect x="22" y="15" width="79" height="95" rx="8" fill="#171b53"/><rect x="15" y="8" width="79" height="95" rx="8" fill="#f6f2de" stroke="#171b53" strokeWidth="1.5"/><path d="M27 23H79M27 31H61" stroke="#243fd0" strokeWidth="3" strokeLinecap="round"/><text x="54" y="77" textAnchor="middle" fontSize="54" fill="#243fd0">৳</text><path d="M28 88H79" stroke="#243fd0" strokeWidth="2"/></g><circle cx="106" cy="95" r="21" fill="#d9f36b" stroke="#171b53" strokeWidth="1.5"/><path d="M96 95L103 102L116 88" stroke="#171b53" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <button type="button" className="home2-main-action" data-testid="home2-pay" onClick={openAllTaxPayments}>{t('Start payment','কর পরিশোধ শুরু করুন')}<ArrowRight size={20} aria-hidden="true"/></button>
      </section>
      <section className="home2-tile home2-travel">
        <div className="home2-label"><span>{t('03 — TRAVEL','০৩ — ভ্রমণ')}</span><ArrowUpRight size={18} aria-hidden="true"/></div>
        <svg viewBox="0 0 120 90" aria-hidden="true"><circle cx="60" cy="45" r="39" stroke="#789342" fill="none"/><ellipse cx="60" cy="45" rx="17" ry="39" stroke="#789342" fill="none"/><path d="M21 45H99M28 24H92M28 66H92" stroke="#789342" fill="none"/><path d="M12 62L104 13L86 83L65 58L45 71L48 53Z" fill="#182c26" stroke="#182c26" strokeLinejoin="round" strokeWidth="2"/><path d="M65 58L104 13L48 53" stroke="#d9f36b" strokeWidth="1.5" fill="none"/></svg>
        <h2>{t('Travel Tax.','ভ্রমণ কর।')}</h2><p>{t('Ready for departure?','যাত্রার জন্য প্রস্তুত?')}</p><button type="button" className="home2-text-action" data-testid="home2-travel" onClick={()=>openPaymentServiceChoice('TRAVEL_TAX')}>{t('Pay now','এখন পরিশোধ করুন')}<ArrowRight size={18} aria-hidden="true"/></button>
      </section>
      <div className="home2-tile home2-record"><div className="home2-label">{t('04 — RETRIEVE','০৪ — রেকর্ড খুঁজুন')}</div><span className="home2-search-mark"><ScanSearch size={26} aria-hidden="true"/></span>{recordSearch}</div>
      <section className="home2-tile home2-cert"><div className="home2-label"><span>{t('05 — DOCUMENTS','০৫ — সনদ')}</span><ArrowUpRight size={18} aria-hidden="true"/></div><div className="home2-media-row"><div><h2>{t('Proof of payment.','পেমেন্টের প্রমাণ।')}</h2><p>{t('View, print and download tax certificates.','কর সনদ দেখুন, প্রিন্ট ও ডাউনলোড করুন।')}</p><button className="home2-text-action" type="button" onClick={()=>navigate(signedIn?'certificates':'verify',{fromHome2:true})}>{t('Tax certificates','কর সনদ')}<ArrowRight size={18} aria-hidden="true"/></button></div>
      <svg viewBox="0 0 115 105" aria-hidden="true"><g transform="rotate(12 57 51)"><rect x="22" y="9" width="70" height="85" rx="5" fill="#a79ad7"/></g><g transform="rotate(-10 52 49)"><rect x="10" y="4" width="76" height="85" rx="5" fill="#fffdfa" stroke="#30244f" strokeWidth="1.5"/><rect x="16" y="10" width="64" height="73" rx="2" fill="none" stroke="#a79ad7"/><path d="M29 25H67M22 37H74M26 43H70M32 50H64" stroke="#65558e" strokeWidth="2" strokeLinecap="round"/><path d="M40 66L36 89L46 83L54 89L55 66" fill="#243fd0"/><circle cx="48" cy="65" r="13" fill="#fa673d" stroke="#30244f"/><circle cx="48" cy="65" r="8" fill="none" stroke="#fffdfa"/></g></svg></div></section>
      {small('corrections')}{small('history')}{small('again')}{small('drafts')}
      <section className="home2-tile home2-account"><div className="home2-label">{t('YOUR PERSONAL SPACE','আপনার ব্যক্তিগত তথ্য')}</div><span className="home2-account-icon"><UserRound size={28} aria-hidden="true"/></span><h2>{t("Everything that's yours.",'আপনার সব তথ্য।')}</h2><p>{t('Your tax account, beneficiaries and records.','আপনার কর অ্যাকাউন্ট, সুবিধাভোগী ও রেকর্ড।')}</p><button type="button" className="home2-text-action" onClick={()=>navigate(signedIn?'taxpayer_home':'taxpayer_login',{fromHome2:true})}>{signedIn?t('Open dashboard','ড্যাশবোর্ড দেখুন'):t('Sign in to your account','অ্যাকাউন্টে সাইন ইন করুন')}<ArrowRight size={18} aria-hidden="true"/></button>{signedIn&&<button type="button" className="home2-text-action" onClick={()=>navigate('beneficiaries')}>{t('Manage beneficiaries','সুবিধাভোগী পরিচালনা')}<ArrowRight size={18} aria-hidden="true"/></button>}</section>
    </div>
  </div>;
}
