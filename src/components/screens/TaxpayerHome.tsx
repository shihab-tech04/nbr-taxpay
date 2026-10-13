import React from 'react';
import { Activity, ArrowRight, Bell, BookOpen, CheckCircle2, CircleAlert, Clock3, CreditCard, FileCheck2, FileClock, FilePenLine, Landmark, Link2, LockKeyhole, Plus, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import { useAccountIdentity } from '../../services/accountIdentity';
import type { TreasuryStatus, TaxCreditStatus } from '../../types/tax';

const treasuryLabels: Record<TreasuryStatus, [string,string]> = {
  INITIATED:['Initiated','শুরু হয়েছে'], GATEWAY_PENDING:['Gateway pending','গেটওয়েতে অপেক্ষমাণ'],
  GATEWAY_SUCCESS:['Gateway success · sample','গেটওয়েতে সফল · নমুনা'],
  TREASURY_SCROLLED:['Treasury recorded · sample','ট্রেজারিতে নথিভুক্ত · নমুনা'],
  FAILED:['Failed','ব্যর্থ'], EXPIRED:['Expired','মেয়াদ শেষ'], REVERSED:['Reversed','প্রত্যাবর্তিত']
};
const creditLabels: Record<TaxCreditStatus, [string,string]> = {
  NOT_APPLICABLE:['Not applicable','প্রযোজ্য নয়'],
  PENDING_RECONCILIATION:['Awaiting reconciliation','সমন্বয়ের অপেক্ষায়'],
  CREDITED_TO_LEDGER:['Ledger credit · sample, unverified','লেজার ক্রেডিট · নমুনা, যাচাইকৃত নয়'],
  CLAIMED_IN_RETURN:['Claimed · sample, unverified','দাবিকৃত · নমুনা, যাচাইকৃত নয়'],
  DISPUTED:['Disputed','বিরোধপূর্ণ']
};

export const TaxpayerHome: React.FC = () => {
  const { taxpayerProfile, receipts, navigate, selectReceipt, language, demoUser } = useTaxState();
  const { user: verifiedUser } = useAccountIdentity();
  const bn = language === 'bn';
  const t = (en: string, bengali: string) => bn ? bengali : en;
  // These records are fixtures selected by payer TIN, not independently verified ownership.
  // Never aggregate them into actual liabilities, recognized credit, or a real account balance.
  const examples = demoUser ? receipts.filter(r => r.payerTin === taxpayerProfile.tin).slice(0, 4) : [];
  const sample = !verifiedUser;
  const services = [
    {route:'history', Icon:Activity, en:'Payments & activity', bn:'পেমেন্ট ও লেনদেন', sub:'Payments and statuses', subBn:'পেমেন্ট ও অবস্থা'},
    {route:'ledger', Icon:BookOpen, en:'Tax ledger', bn:'কর লেজার', sub:'Credits and adjustments', subBn:'ক্রেডিট ও সমন্বয়'},
    {route:'certificates', Icon:FileCheck2, en:'Certificates', bn:'সনদপত্র', sub:'Receipts and documents', subBn:'রসিদ ও নথি'},
    {route:'corrections', Icon:FilePenLine, en:'Corrections', bn:'সংশোধন', sub:'Resolve an issue', subBn:'সমস্যা সমাধান'},
    {route:'journey', Icon:FileClock, en:'Lifecycle timeline', bn:'জীবনচক্র টাইমলাইন', sub:'Lifecycle milestones', subBn:'ধাপভিত্তিক অগ্রগতি'},
    {route:'account_notifications', Icon:Bell, en:'Notifications', bn:'বিজ্ঞপ্তি', sub:'Updates and alerts', subBn:'আপডেট ও সতর্কতা'}
  ];
  return (
    <div className={`mx-auto max-w-6xl space-y-5 pb-12 ${bn?'font-bengali':''}`}>
      <header className="relative overflow-hidden rounded-[26px] bg-[#194b3b] p-5 text-white sm:p-8 lg:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[42px] border-white/5" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-[#c2e6d2]"><Landmark size={16} aria-hidden="true" />{t('Taxpayer workspace','করদাতা ওয়ার্কস্পেস')}</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('My Tax Payments','আমার কর পেমেন্ট')}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#e1f2e8]">{t('Follow every payment from initiation to treasury confirmation, ledger reconciliation and its supporting documents.','পেমেন্ট শুরু থেকে ট্রেজারি নিশ্চিতকরণ, লেজার সমন্বয় ও প্রয়োজনীয় নথি পর্যন্ত প্রতিটি ধাপ অনুসরণ করুন।')}</p>
            <p className="mt-3 text-xs text-[#d0eadb]">{sample?t('Example workspace · not a verified taxpayer account','নমুনা ওয়ার্কস্পেস · যাচাইকৃত করদাতা অ্যাকাউন্ট নয়'):t('Signed-in application · tax credit still requires independent verification','সাইন ইন করা অ্যাপ · কর ক্রেডিটের পৃথক যাচাই প্রয়োজন')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={()=>navigate('wizard')} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f3e4b5] px-5 py-3 text-sm font-extrabold text-[#214537] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Plus size={18} aria-hidden="true"/>{t('Start a payment','পেমেন্ট শুরু করুন')}</button>
            <button type="button" onClick={()=>navigate('history')} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/35 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"><Activity size={17} aria-hidden="true"/>{t('Track payments','পেমেন্ট ট্র্যাক করুন')}<ArrowRight size={16} aria-hidden="true"/></button>
          </div>
        </div>
      </header>

      <section aria-labelledby="position-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-[#345d46]">{t('Your account at a glance','আপনার হিসাব এক নজরে')}</p><h2 id="position-heading" className="mt-1 text-xl font-extrabold text-slate-900">{t('Tax position','করের অবস্থান')}</h2></div><button type="button" onClick={()=>navigate('ledger')} className="inline-flex items-center gap-1 text-sm font-bold text-[#18553d] hover:underline">{t('Open ledger','লেজার খুলুন')}<ArrowRight size={16}/></button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {Icon:WalletCards, title:t('Outstanding tax','বকেয়া কর'), value:t('Unavailable','পাওয়া যাচ্ছে না'), hint:t('No verified assessment source','যাচাইকৃত কর নির্ধারণ নেই'), tone:'bg-[#e7f0e9]'},
            {Icon:ShieldCheck, title:t('Recognized credit','স্বীকৃত কর ক্রেডিট'), value:t('Unverified','যাচাই হয়নি'), hint:t('Do not infer from payment receipt','রসিদ থেকে ক্রেডিট অনুমান নয়'), tone:'bg-[#f4ecdc]'},
            {Icon:Clock3, title:t('Pending reconciliation','সমন্বয়ের অপেক্ষায়'), value:t('Not established','নির্ধারিত নয়'), hint:t('Requires verified treasury and ownership records','ট্রেজারি ও মালিকানার প্রমাণ প্রয়োজন'), tone:'bg-[#e8ecf4]'},
            {Icon:ReceiptText, title:t('Verified paid total','যাচাইকৃত মোট পরিশোধ'), value:t('Not connected','সংযুক্ত নয়'), hint:t('No authoritative total connected','কর্তৃত্বপূর্ণ মোট তথ্য সংযুক্ত নয়'), tone:'bg-[#f0ece5]'}
          ].map(({Icon,title,value,hint,tone})=>(
            <article key={title} className="rounded-2xl border border-[#e0e7e0] bg-white p-4 shadow-sm sm:p-5">
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#245540] ${tone}`}><Icon size={20} aria-hidden="true"/></div>
              <p className="text-sm font-medium text-slate-600">{title}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p><p className="mt-2 text-xs leading-5 text-slate-700">{hint}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(270px,1fr)]">
        <section aria-labelledby="lifecycle-heading" className="rounded-[22px] border border-[#dfe8e1] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#345d46]">{t('Payment lifecycle','পেমেন্ট জীবনচক্র')}</p><h2 id="lifecycle-heading" className="mt-1 text-xl font-extrabold text-slate-900">{t('Know where your payment stands','আপনার পেমেন্টের অবস্থান জানুন')}</h2></div><button onClick={()=>navigate('journey')} type="button" className="inline-flex items-center gap-1 text-sm font-bold text-[#18553d] hover:underline">{t('Full journey','সম্পূর্ণ যাত্রা')}<ArrowRight size={16}/></button></div>
          <p className="mt-2 text-sm text-slate-700">{t('These are process stages, not a claim that your payments have completed them.','এগুলো প্রক্রিয়ার ধাপ; আপনার পেমেন্ট সব ধাপ সম্পন্ন করেছে এমন দাবি নয়।')}</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {Icon:CreditCard, n:'01', en:'Payment initiated', bn:'পেমেন্ট শুরু', de:'Create or locate a payment request', db:'পেমেন্ট অনুরোধ তৈরি বা খুঁজুন', route:'wizard'},
              {Icon:Clock3, n:'02', en:'Gateway processing', bn:'গেটওয়ে প্রক্রিয়া', de:'Check its transaction status', db:'লেনদেনের অবস্থা দেখুন', route:'history'},
              {Icon:CheckCircle2, n:'03', en:'Treasury confirmation', bn:'ট্রেজারি নিশ্চিতকরণ', de:'Confirm settlement independently', db:'স্বতন্ত্রভাবে জমা নিশ্চিত করুন', route:'history'},
              {Icon:BookOpen, n:'04', en:'Ledger reconciliation', bn:'লেজার সমন্বয়', de:'Check ownership and credit status', db:'মালিকানা ও ক্রেডিট যাচাই করুন', route:'ledger'}
            ].map(item=><li key={item.n}><button type="button" onClick={()=>navigate(item.route)} className="group flex h-full w-full items-start gap-3 rounded-2xl border border-[#e3e9e2] bg-[#fafbf8] p-4 text-left transition hover:border-[#8cbba0] hover:bg-[#edf6ef]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e2eee4] text-[#20563c]"><item.Icon size={19} aria-hidden="true"/></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-extrabold text-[#345d46]">{item.n}</span><span className="mt-0.5 block text-sm font-extrabold text-slate-900">{bn?item.bn:item.en}</span><span className="mt-1 block text-xs leading-5 text-slate-700">{bn?item.db:item.de}</span></span><ArrowRight size={15} className="mt-1 text-[#457258] group-hover:translate-x-0.5" aria-hidden="true"/></button></li>)}
          </ol>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff6e7] p-3 text-xs leading-5 text-[#79562a]"><CircleAlert size={18} className="shrink-0" aria-hidden="true"/><p>{t('Gateway success or a challan does not automatically establish recognized tax credit. Treasury, taxpayer ownership and duplicate checks are separate.','গেটওয়ে সফল বা চালান থাকা মানেই স্বীকৃত কর ক্রেডিট নয়। ট্রেজারি, করদাতার মালিকানা ও ডুপ্লিকেট যাচাই পৃথক।')}</p></div>
        </section>

        <section aria-labelledby="actions-heading" className="rounded-[22px] border border-[#dfe8e1] bg-[#edf4e9] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#345d46]">{t('Do next','পরবর্তী কাজ')}</p><h2 id="actions-heading" className="mt-1 text-xl font-extrabold text-slate-900">{t('Your essentials','আপনার প্রয়োজনীয় কাজ')}</h2>
          <div className="mt-4 space-y-2">
            {[
              {Icon:Plus, route:'wizard', en:'Make a payment', bn:'পেমেন্ট করুন'},
              {Icon:ReceiptText, route:'history', en:'Find a transaction', bn:'লেনদেন খুঁজুন'},
              {Icon:BookOpen, route:'ledger', en:'Review tax credits', bn:'কর ক্রেডিট দেখুন'},
              {Icon:FilePenLine, route:'corrections', en:'Raise a correction', bn:'সংশোধনের আবেদন'},
              {Icon:FileCheck2, route:'certificates', en:'Open documents', bn:'নথি দেখুন'}
            ].map(({Icon,route,en,bn:be})=><button key={route} type="button" onClick={()=>navigate(route)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#dce9da] bg-white px-4 py-3 text-left text-sm font-bold text-[#214c38] hover:border-[#90bca1] hover:bg-[#f8fcf8]"><Icon size={18} aria-hidden="true"/><span className="flex-1">{bn?be:en}</span><ArrowRight size={16} aria-hidden="true"/></button>)}
          </div>
        </section>
      </div>

      <section aria-labelledby="recent-heading" className="rounded-[22px] border border-[#dfe8e1] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#345d46]">{t('Transaction timeline','লেনদেন টাইমলাইন')}</p><h2 id="recent-heading" className="mt-1 text-xl font-extrabold text-slate-900">{t('Recent payment activity','সাম্প্রতিক পেমেন্ট')}</h2></div><button type="button" onClick={()=>navigate('history')} className="inline-flex items-center gap-1 text-sm font-bold text-[#18553d] hover:underline">{t('View all transactions','সব লেনদেন দেখুন')}<ArrowRight size={16}/></button></div>
        {examples.length ? <><p className="mt-2 text-xs text-amber-700">{t('Example transactions only · not your verified payment history','শুধু নমুনা লেনদেন · আপনার যাচাইকৃত পেমেন্ট ইতিহাস নয়')}</p><div className="mt-4 divide-y divide-[#e8eee7]">{examples.map(receipt=><article key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-[#e8f2e8] p-2 text-[#24583f]"><ReceiptText size={19} aria-hidden="true"/></span><div className="min-w-0"><p className="break-all font-mono-plex text-sm font-extrabold text-slate-900">{receipt.challanNo}</p><p className="mt-1 text-xs text-slate-700">{t('Assessment year','করবর্ষ')} {receipt.assessmentYear}</p><p className="mt-1 text-xs text-slate-600">{(bn?treasuryLabels[receipt.treasuryStatus][1]:treasuryLabels[receipt.treasuryStatus][0])} · {(bn?creditLabels[receipt.taxCreditStatus][1]:creditLabels[receipt.taxCreditStatus][0])}</p></div></div><div className="flex items-center gap-3"><p className="font-extrabold tabular-nums text-slate-900">{formatCurrency(receipt.totalAmount,language)}</p><button type="button" onClick={()=>selectReceipt(receipt.id)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#dce6dc] px-3 text-xs font-bold text-[#20563c] hover:bg-[#edf5ed]">{t('Details','বিস্তারিত')}<ArrowRight size={14}/></button></div></article>)}</div></>:<div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f5f8f4] p-5"><FileClock size={24} className="shrink-0 text-[#60826a]" aria-hidden="true"/><div><p className="font-bold text-slate-800">{t('No verified transactions to display','প্রদর্শনের মতো যাচাইকৃত লেনদেন নেই')}</p><p className="mt-1 text-sm text-slate-700">{t('When account-linked records are available, payment milestones will appear here.','অ্যাকাউন্ট-সংযুক্ত তথ্য পাওয়া গেলে পেমেন্টের ধাপ এখানে দেখা যাবে।')}</p></div></div>}
      </section>

      <section aria-labelledby="services-heading"><div className="mb-3"><p className="text-xs font-bold uppercase tracking-wider text-[#345d46]">{t('Explore services','সেবাসমূহ')}</p><h2 id="services-heading" className="mt-1 text-xl font-extrabold text-slate-900">{t('Everything in one place','সবকিছু এক জায়গায়')}</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{services.map(({route,Icon,en,bn:be,sub,subBn})=><button key={route} type="button" aria-label={route==='ledger'?t('Tax ledger','কর লেজার'):undefined} onClick={()=>navigate(route)} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-[#e0e9e0] bg-white p-4 text-left shadow-sm hover:border-[#9ac6a7] hover:bg-[#f7fbf7]"><span className="rounded-xl bg-[#e8f1e8] p-3 text-[#20583c]"><Icon size={20} aria-hidden="true"/></span><span className="flex-1"><span className="block text-sm font-extrabold text-slate-900">{bn?be:en}</span><span className="mt-1 block text-xs text-slate-700">{bn?subBn:sub}</span></span><ArrowRight size={17} className="text-[#57816a]" aria-hidden="true"/></button>)}</div></section>
      <details className="citizen-taxpayer-more rounded-2xl border border-[#dfe8e1] bg-white p-4"><summary className="cursor-pointer text-sm font-extrabold text-[#20563c]">{t('More taxpayer services','আরও করদাতা সেবা')}</summary><div className="mt-4 grid gap-2 sm:grid-cols-2">{[{route:'dashboard',en:'Dashboard',bn:'কর সারসংক্ষেপ'},{route:'journey',en:'Tax journey',bn:'কর যাত্রা'},{route:'notifications',en:'Notifications',bn:'বিজ্ঞপ্তি'},{route:'services',en:'Connected services',bn:'সংযুক্ত সেবা'}].map(item=><button key={item.route} type="button" onClick={()=>navigate(item.route)} className="flex min-h-12 items-center justify-between rounded-xl border border-[#dfe8e1] px-4 py-3 text-sm font-bold text-[#20563c] hover:bg-[#edf6ef]"><span>{bn?item.bn:item.en}</span><ArrowRight size={16}/></button>)}</div></details>
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe8e1] bg-[#f9fbf8] p-4"><div className="flex items-center gap-2 text-sm text-slate-600"><LockKeyhole size={17} className="text-[#286448]" aria-hidden="true"/><p>{t('Account access and profile settings','অ্যাকাউন্ট প্রবেশ ও প্রোফাইল সেটিংস')}</p></div><button type="button" onClick={()=>navigate('account_profile')} className="inline-flex items-center gap-1 text-sm font-bold text-[#20563c] hover:underline">{t('Manage profile','প্রোফাইল পরিচালনা')}<ArrowRight size={16}/></button></footer>
    </div>
  );
};
