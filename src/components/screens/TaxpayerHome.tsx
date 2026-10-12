import React from 'react';
import { ArrowRight, BookOpen, FileCheck2, FileClock, HelpCircle, Landmark, LayoutDashboard, Bell, CircleHelp, Receipt, Link2, FilePenLine } from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { formatCurrency } from '../../services/numberFormat';
import type { TreasuryStatus, TaxCreditStatus } from '../../types/tax';

type Destination = {
  route: string;
  en: string;
  bn: string;
  Icon: React.ComponentType<{size?:number; 'aria-hidden'?: boolean}>;
};
const destinations: Destination[] = [
  {route:'dashboard',en:'Dashboard',bn:'কর সারসংক্ষেপ',Icon:LayoutDashboard},
  {route:'history',en:'Payments & activity',bn:'পেমেন্ট ও লেনদেন',Icon:Receipt},
  {route:'ledger',en:'Tax ledger',bn:'কর লেজার',Icon:BookOpen},
  {route:'journey',en:'Tax journey',bn:'করের ইতিহাস',Icon:FileClock},
  {route:'certificates',en:'Certificates',bn:'সনদপত্র',Icon:FileCheck2},
  {route:'corrections',en:'Corrections',bn:'সংশোধন',Icon:FilePenLine},
  {route:'notifications',en:'Notifications',bn:'বিজ্ঞপ্তি',Icon:Bell},
  {route:'services',en:'Connected services',bn:'সংযুক্ত সেবা',Icon:Link2}
];

const treasuryLabels: Record<TreasuryStatus, {en:string;bn:string}> = {
  INITIATED:{en:'Initiated',bn:'শুরু হয়েছে'},
  GATEWAY_PENDING:{en:'Gateway pending',bn:'গেটওয়েতে অপেক্ষমাণ'},
  GATEWAY_SUCCESS:{en:'Gateway success (sample)',bn:'গেটওয়েতে সফল (নমুনা)'},
  TREASURY_SCROLLED:{en:'Treasury-scrolled (sample)',bn:'ট্রেজারিতে নথিভুক্ত (নমুনা)'},
  FAILED:{en:'Failed',bn:'ব্যর্থ'},
  EXPIRED:{en:'Expired',bn:'মেয়াদ শেষ'},
  REVERSED:{en:'Reversed',bn:'বাতিল / প্রত্যাবর্তিত'}
};
const creditLabels: Record<TaxCreditStatus,{en:string;bn:string}> = {
  NOT_APPLICABLE:{en:'Not applicable',bn:'প্রযোজ্য নয়'},
  PENDING_RECONCILIATION:{en:'Awaiting reconciliation',bn:'সমন্বয়ের অপেক্ষায়'},
  CREDITED_TO_LEDGER:{en:'Sample credited state (unverified)',bn:'নমুনা ক্রেডিট অবস্থা (যাচাই হয়নি)'},
  CLAIMED_IN_RETURN:{en:'Sample claim state (unverified)',bn:'নমুনা দাবির অবস্থা (যাচাই হয়নি)'},
  DISPUTED:{en:'Disputed',bn:'বিরোধপূর্ণ'}
};

export const TaxpayerHome: React.FC = () => {
  const { taxpayerProfile, receipts, navigate, selectReceipt, language } = useTaxState();
  const bn = language === 'bn';
  // This fixture has payerTin, not a verified tax-credit owner. It must never be used to
  // compute a personal ledger balance or prove that this account received tax credit.
  const initiatedExamples = receipts.filter(r => r.payerTin === taxpayerProfile.tin).slice(0,3);
  const label = (en:string, bengali:string) => bn ? bengali : en;

  return (
    <div className={`mx-auto max-w-5xl space-y-5 pb-12 ${bn ? 'font-bengali' : ''}`}>
      <section aria-label={label('Taxpayer overview','করদাতার সারসংক্ষেপ')} className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-taxpay-dark">{label('Sample taxpayer account','নমুনা করদাতা অ্যাকাউন্ট')}</p>
            <h1 className="text-2xl font-bold leading-snug text-taxpay-text sm:text-3xl">{label('Your tax position','আপনার কর অবস্থান')}</h1>
            <p className="text-sm text-taxpay-muted">{label('Balances are not connected to NBR or Treasury.','ব্যালেন্স এনবিআর বা ট্রেজারির সাথে সংযুক্ত নয়।')}</p>
          </div>
          <span className="inline-flex items-center rounded-md bg-taxpay-light px-3 py-2 text-xs font-semibold text-taxpay-dark">
            {label('Demo only','শুধু নমুনা')}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-lg border border-taxpay-border p-4">
            <p className="text-xs text-taxpay-muted">{label('Outstanding tax','বকেয়া কর')}</p>
            <p className="mt-2 text-lg font-semibold text-taxpay-text">{label('Unavailable','পাওয়া যাচ্ছে না')}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-taxpay-border p-4">
            <p className="text-xs text-taxpay-muted">{label('Recognized credit','স্বীকৃত কর ক্রেডিট')}</p>
            <p className="mt-2 text-lg font-semibold text-taxpay-text">{label('Unverified','যাচাই হয়নি')}</p>
          </div>
        </div>
        <details className="mt-3 rounded-lg bg-taxpay-background p-3 text-sm text-taxpay-muted">
          <summary className="cursor-pointer font-semibold text-taxpay-dark">{label('Why are balances unavailable?','ব্যালেন্স কেন পাওয়া যাচ্ছে না?')}</summary>
          <p className="mt-2 leading-relaxed">{label('This demonstration has no verified account-specific ledger owner, Treasury reconciliation or live taxpayer records. Sample transactions are not tax credit or payment proof.','এই প্রদর্শনীতে করদাতাভিত্তিক যাচাইকৃত লেজার, ট্রেজারি সমন্বয় বা প্রকৃত করদাতার তথ্য নেই। নমুনা লেনদেন কর ক্রেডিট বা পরিশোধের প্রমাণ নয়।')}</p>
        </details>
      </section>

      <section className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5" aria-label={label('Sample identity','নমুনা পরিচয়')}>
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-taxpay-light text-taxpay-dark"><Landmark size={22}/></div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-taxpay-text">{bn ? taxpayerProfile.nameBn : taxpayerProfile.nameEn}</h2>
            <p className="text-xs text-taxpay-muted">e-TIN: <span className="font-mono-plex">{taxpayerProfile.tin}</span> · {taxpayerProfile.type}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="taxpay-recent-title" className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="taxpay-recent-title" className="text-lg font-bold text-taxpay-text">{label('Recent activity','সাম্প্রতিক লেনদেন')}</h2>
          <button type="button" onClick={()=>navigate('history')} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light">
            {label('View all','সব দেখুন')} <ArrowRight size={16} aria-hidden="true"/>
          </button>
        </div>
        <p className="mb-3 text-xs text-taxpay-muted">{label('Example transactions initiated using this payer TIN; credit ownership is not verified.','এই পরিশোধকারীর টিআইএন দিয়ে শুরু করা নমুনা লেনদেন; ক্রেডিটের মালিকানা যাচাইকৃত নয়।')}</p>
        {initiatedExamples.length === 0 ? (
          <p className="rounded-lg bg-taxpay-background p-4 text-sm text-taxpay-muted">{label('No sample transactions for this profile.','এই নমুনা প্রোফাইলে কোনো লেনদেন নেই।')}</p>
        ) : (
          <div className="divide-y divide-taxpay-border">
            {initiatedExamples.map(receipt => (
              <article key={receipt.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-mono-plex text-sm font-semibold text-taxpay-text">{receipt.challanNo}</p>
                    <p className="mt-1 text-xs text-taxpay-muted">{label('Assessment year','করবর্ষ')} {receipt.assessmentYear}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-taxpay-text">{formatCurrency(receipt.totalAmount,language)}</p>
                </div>
                <p className="mt-2 text-xs text-taxpay-muted">{label('Demo Treasury','নমুনা ট্রেজারি')}: {bn ? treasuryLabels[receipt.treasuryStatus].bn : treasuryLabels[receipt.treasuryStatus].en}</p>
                <p className="text-xs text-taxpay-muted">{label('Demo tax credit','নমুনা কর ক্রেডিট')}: {bn ? creditLabels[receipt.taxCreditStatus].bn : creditLabels[receipt.taxCreditStatus].en}</p>
                <button type="button" onClick={()=>selectReceipt(receipt.id)} className="mt-2 min-h-11 rounded-md px-2 text-sm font-semibold text-taxpay-dark hover:bg-taxpay-light">
                  {label('View sample receipt','নমুনা রসিদ দেখুন')} <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="taxpay-services-title" className="rounded-xl border border-taxpay-border bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="taxpay-services-title" className="text-lg font-bold text-taxpay-text">{label('Services','সেবাসমূহ')}</h2>
          <span title={label('Each service uses demonstration records only.','প্রতিটি সেবায় শুধু নমুনা তথ্য দেখানো হয়।')} aria-label={label('Demonstration services','নমুনা সেবাসমূহ')} className="text-taxpay-muted"><CircleHelp size={16}/></span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {destinations.map(({route,en,bn:bnName,Icon})=>(
            <button type="button" key={route} onClick={()=>navigate(route)}
              className="flex min-h-12 items-center gap-3 rounded-lg border border-taxpay-border bg-white px-3 py-3 text-left text-sm font-semibold text-taxpay-text hover:border-taxpay-primary hover:bg-taxpay-light">
              <Icon size={19} aria-hidden={true}/>
              <span className="min-w-0 flex-1">{bn ? bnName : en}</span>
              <ArrowRight size={16} aria-hidden={true}/>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-taxpay-muted">{label('Not reconciled with eReturn / NBR','ই-রিটার্ন / এনবিআরের সাথে সমন্বিত নয়')}</p>
      </section>
    </div>
  );
};
