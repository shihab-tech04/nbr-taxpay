import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, BookOpen, CalendarDays,
  ChevronRight, CircleHelp, Clock3, CreditCard, FileCheck2,
  FilePenLine, Landmark, Layers3, ListChecks, ReceiptText, RefreshCw,
  ShieldCheck, WalletCards
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';
import { useAccountIdentity } from '../../services/accountIdentity';
import {
  demoTransactions, getDemoUserTransactions, type DemoTransaction, type DemoUserId
} from '../../data/demoPaymentTransactions';
import {
  getBoundSimulationUser, getPrivateSimulationHistory,
  formatSimulatedAmount, type SimulationTransaction, type SimulationUser
} from '../../services/simulatedPaymentsApi';
import '../../styles/taxpay-lifecycle.css';

type Perspective = 'payer' | 'beneficiary';
type PaymentState = 'SIMULATED' | 'PENDING' | 'FAILED' | 'REVERSED';
type ActivityRow = {
  id: string;
  createdAt: string;
  state: PaymentState;
  amountMinor: number;
  years: string[];
  categories: string[];
  reviewStatus?: string;
};
type ActivityData = {
  kind: 'loading' | 'disconnected' | 'sample' | 'protected' | 'error';
  payer: ActivityRow[];
  beneficiary: ActivityRow[];
  error?: string;
};
const empty = (kind: ActivityData['kind']): ActivityData => ({kind, payer: [], beneficiary: []});
const stateOrder: PaymentState[] = ['SIMULATED', 'PENDING', 'FAILED', 'REVERSED'];

function fromPublicDemo(transaction: DemoTransaction, view: Perspective, id: DemoUserId): ActivityRow {
  const allocations = view === 'payer'
    ? transaction.allocations
    : transaction.allocations.filter(line => line.beneficiary === id);
  return {
    id: transaction.id, createdAt: transaction.createdAt, state: transaction.state,
    amountMinor: allocations.reduce((sum, line) => sum + line.amountMinor, 0),
    years: [...new Set(allocations.map(line => line.assessmentYear))],
    categories: [...new Set(allocations.map(line => line.category))]
  };
}
function fromPrivateSimulation(transaction: SimulationTransaction, view: Perspective, id: SimulationUser): ActivityRow {
  const allocations = view === 'payer'
    ? transaction.allocations
    : transaction.allocations.filter(line => line.beneficiary === id);
  return {
    id: transaction.id, createdAt: transaction.createdAt, state: transaction.state,
    amountMinor: allocations.reduce((sum, line) => sum + line.amountMinor, 0),
    years: [...new Set(allocations.map(line => line.assessmentYear))],
    categories: [...new Set(allocations.map(line => line.category))],
    reviewStatus: transaction.reviewStatus
  };
}

export const TaxpayerHome: React.FC = () => {
  const { navigate, language, demoUser } = useTaxState();
  const { user: applicationUser, loading: identityLoading } = useAccountIdentity();
  const [data, setData] = useState<ActivityData>(() => empty('loading'));
  const [perspective, setPerspective] = useState<Perspective>('payer');
  const [year, setYear] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const bn = language === 'bn';
  const label = (en: string, bengali: string) => bn ? bengali : en;

  // A demo URL is not an authenticated person. A signed-in account is queried
  // only through the owner's RLS-protected profile/history RPCs. No cross-user
  // fallback, TIN ownership guess, Treasury assertion or ledger credit occurs.
  useEffect(() => {
    let active = true;
    if (applicationUser) {
      setData(empty('loading'));
      void (async () => {
        try {
          const bound = await getBoundSimulationUser();
          if (!bound) throw Error('No approved simulation profile assignment');
          const [payer, beneficiary] = await Promise.all([
            getPrivateSimulationHistory('payer'),
            getPrivateSimulationHistory('beneficiary')
          ]);
          if (active) setData({
            kind: 'protected',
            payer: payer.map(item => fromPrivateSimulation(item, 'payer', bound)),
            beneficiary: beneficiary.map(item => fromPrivateSimulation(item, 'beneficiary', bound))
          });
        } catch {
          if (active) setData({...empty('error'), error: 'Protected simulation history could not be verified.'});
        }
      })();
    } else if (demoUser) {
      setData({
        kind: 'sample',
        payer: getDemoUserTransactions(demoUser.id, demoTransactions, 'payer')
          .map(item => fromPublicDemo(item, 'payer', demoUser.id)),
        beneficiary: getDemoUserTransactions(demoUser.id, demoTransactions, 'beneficiary')
          .map(item => fromPublicDemo(item, 'beneficiary', demoUser.id))
      });
    } else if (!identityLoading) {
      setData(empty('disconnected'));
    }
    return () => { active = false; };
  }, [applicationUser?.id, demoUser?.id, identityLoading, refreshKey]);

  const hasEvidence = data.kind === 'sample' || data.kind === 'protected';
  const records = perspective === 'payer' ? data.payer : data.beneficiary;
  const years = useMemo(() => [...new Set([...data.payer, ...data.beneficiary].flatMap(row => row.years))]
    .sort((a, b) => b.localeCompare(a)), [data]);
  const recent = useMemo(() => records
    .filter(row => year === 'ALL' || row.years.includes(year))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 4), [records, year]);
  const pending = data.payer.filter(row => row.state === 'PENDING');
  const exceptions = data.payer.filter(row => row.state === 'FAILED' || row.state === 'REVERSED');
  const distribution = stateOrder.map(state => ({
    state, count: records.filter(row => (year === 'ALL' || row.years.includes(year)) && row.state === state).length
  }));
  const distributionTotal = distribution.reduce((sum, item) => sum + item.count, 0);
  const stateName = (state: PaymentState) => ({
    SIMULATED: label('Simulated', 'সিমুলেটেড'),
    PENDING: label('Pending', 'অপেক্ষমাণ'),
    FAILED: label('Failed', 'ব্যর্থ'),
    REVERSED: label('Reversed', 'বাতিল / ফেরত')
  })[state];
  const categoriesText = (row: ActivityRow) => row.categories.length > 1
    ? label('Multiple payment types', 'একাধিক পেমেন্টের ধরন')
    : row.categories[0]?.replaceAll('_', ' ') || label('Payment', 'পেমেন্ট');
  const dateText = (iso: string) => Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleDateString(bn ? 'bn-BD' : 'en-GB', {day:'numeric',month:'short',year:'numeric'})
    : label('Date unavailable', 'তারিখ পাওয়া যায়নি');
  const refresh = () => { setYear('ALL'); setRefreshKey(value => value + 1); };

  const stages = [
    {Icon: WalletCards, title: label('Payment initiated', 'পেমেন্ট শুরু'), detail: label('Choose tax type and review details', 'করের ধরন বেছে তথ্য যাচাই'), route:'wizard'},
    {Icon: CreditCard, title: label('Gateway response', 'গেটওয়ের ফলাফল'), detail: label('Check success, pending or failure', 'সফল, অপেক্ষমাণ বা ব্যর্থতা'), route:'history'},
    {Icon: Landmark, title: label('Treasury record', 'ট্রেজারি রেকর্ড'), detail: label('Verify actual government settlement', 'সরকারি জমা যাচাই'), route:'verify'},
    {Icon: Layers3, title: label('Ledger reconciliation', 'লেজার সমন্বয়'), detail: label('Match payment, owner and year', 'পেমেন্ট, মালিকানা ও করবর্ষ মিলানো'), route:'ledger'},
    {Icon: FileCheck2, title: label('Return and evidence', 'রিটার্ন ও প্রমাণ'), detail: label('Check allowable credit separately', 'প্রযোজ্য ক্রেডিট আলাদাভাবে যাচাই'), route:'certificates'}
  ];
  const tools = [
    {Icon: Activity, title:label('Transaction history','লেনদেনের ইতিহাস'), sub:label('Transactions, attempts and status','লেনদেন, চেষ্টা ও অবস্থা'),route:'history'},
    {Icon: BookOpen, title:label('Tax ledger','কর লেজার'), sub:label('Entries and reconciliation','এন্ট্রি ও সমন্বয়'),route:'ledger'},
    {Icon: ReceiptText, title:label('Payment status','পেমেন্টের অবস্থা'),sub:label('Check a payment reference','পেমেন্ট রেফারেন্স যাচাই'),route:'verify'},
    {Icon: FileCheck2, title:label('Certificates','সনদপত্র'),sub:label('Available evidence and documents','প্রমাণ ও নথিপত্র'),route:'certificates'},
    {Icon: FilePenLine, title:label('Corrections','সংশোধন'),sub:label('Report mismatched information','ভুল তথ্য সংশোধনের আবেদন'),route:'corrections'},
    {Icon: CircleHelp, title:label('Help & guidance','সহায়তা ও নির্দেশনা'),sub:label('Understand each payment stage','প্রতিটি ধাপ বুঝুন'),route:'guidance'}
  ];

  return (
    <div className={`lifecycle-dashboard ${bn ? 'font-bengali' : ''}`} lang={language}>
      <section className="life-hero" aria-labelledby="taxpay-home-title">
        <div className="life-hero__main">
          <p className="life-eyebrow"><ShieldCheck size={16} aria-hidden="true" />{label('Taxpayer workspace','করদাতা ওয়ার্কস্পেস')}</p>
          <h1 id="taxpay-home-title">{label('My Tax Payments', 'আমার কর পেমেন্ট')}</h1>
          <p className="life-hero__description">{label(
            'One place to follow your payment journey — from starting a transaction to checking settlement, reconciliation and evidence.',
            'পেমেন্ট শুরু থেকে সরকারি জমা, সমন্বয় ও প্রমাণ যাচাই—সব ধাপ এক জায়গায় দেখুন।'
          )}</p>
          <div className="life-hero__actions">
            <button type="button" className="life-button life-button--primary" onClick={() => navigate('history')}>
              <Activity size={18} aria-hidden="true"/>{label('Payments & activity','পেমেন্ট ও লেনদেন')}<ArrowRight size={17} aria-hidden="true"/>
            </button>
            <button type="button" className="life-button life-button--light" onClick={() => navigate('wizard')}>
              <WalletCards size={18} aria-hidden="true"/>{label('Explore payment flow','পেমেন্টের ধাপ দেখুন')}
            </button>
          </div>
        </div>
        <div className="life-hero__context">
          <p className="life-context__label">{label('YOUR WORKSPACE','আপনার ওয়ার্কস্পেস')}</p>
          <div className="life-context__symbol"><Landmark size={27} aria-hidden="true"/></div>
          <h2>{data.kind === 'protected' ? label('Protected simulation','সুরক্ষিত সিমুলেশন')
            : data.kind === 'sample' ? label('Example taxpayer','নমুনা করদাতা')
            : label('Account overview','অ্যাকাউন্টের সারসংক্ষেপ')}</h2>
          <p>{hasEvidence
            ? label('Transaction examples only. No real payment, Treasury confirmation or tax credit.', 'শুধু নমুনা লেনদেন। বাস্তব পেমেন্ট বা কর ক্রেডিট নয়।')
            : label('Verified government payment and tax-position data are not connected.', 'সরকারি পেমেন্ট ও করের যাচাইকৃত তথ্য সংযুক্ত নয়।')}</p>
          <button type="button" onClick={() => navigate('secure_workspace')}>
            {label('Account access','অ্যাকাউন্টে প্রবেশ')}<ArrowUpRight size={16} aria-hidden="true"/>
          </button>
        </div>
      </section>

      <section aria-labelledby="life-overview-title" className="life-overview">
        <div className="life-section-heading">
          <div><p className="life-section-kicker">{label('AT A GLANCE','এক নজরে')}</p><h2 id="life-overview-title">{label('Your payment overview','আপনার পেমেন্টের সারসংক্ষেপ')}</h2></div>
          {hasEvidence && <button type="button" onClick={refresh} className="life-inline-link"><RefreshCw size={15} aria-hidden="true"/>{label('Refresh','রিফ্রেশ')}</button>}
        </div>
        <div className="life-metrics">
          <article className="life-metric life-metric--sage">
            <div className="life-metric__top"><p>{label('Payments initiated','শুরু করা পেমেন্ট')}</p><WalletCards size={20} aria-hidden="true"/></div>
            <p className="life-metric__value" aria-label={hasEvidence ? String(data.payer.length) : label('Unavailable','পাওয়া যায়নি')}>{hasEvidence ? data.payer.length : '—'}</p>
            <p className="life-metric__footer">{label('Recorded simulation transactions','রেকর্ডকৃত নমুনা লেনদেন')}</p>
          </article>
          <article className="life-metric life-metric--cream">
            <div className="life-metric__top"><p>{label('Allocated to me','আমার জন্য বরাদ্দ')}</p><Layers3 size={20} aria-hidden="true"/></div>
            <p className="life-metric__value">{hasEvidence ? data.beneficiary.length : '—'}</p>
            <p className="life-metric__footer">{label('Transactions, not approved credits','লেনদেন, অনুমোদিত ক্রেডিট নয়')}</p>
          </article>
          <article className="life-metric life-metric--peach">
            <div className="life-metric__top"><p>{label('Pending / exceptions','অপেক্ষমাণ / সমস্যা')}</p><AlertCircle size={20} aria-hidden="true"/></div>
            <p className="life-metric__value">{hasEvidence ? pending.length + exceptions.length : '—'}</p>
            <p className="life-metric__footer">{label('Among initiated simulations','শুরু করা নমুনা লেনদেনের মধ্যে')}</p>
          </article>
          <article className="life-metric life-metric--blue">
            <div className="life-metric__top"><p>{label('Recognized credit','স্বীকৃত কর ক্রেডিট')}</p><ShieldCheck size={20} aria-hidden="true"/></div>
            <p className="life-metric__value life-metric__value--word">{label('Unverified','যাচাই হয়নি')}</p>
            <p className="life-metric__footer">{label('Not calculated from payments','পেমেন্ট থেকে গণনা করা হয়নি')}</p>
          </article>
        </div>
        <div className="life-position" aria-labelledby="life-position-title">
          <div className="life-position__heading"><ShieldCheck size={19} aria-hidden="true"/><h2 id="life-position-title">{label('Tax position','করের অবস্থান')}</h2></div>
          <div className="life-position__detail"><p>{label('Outstanding tax','বকেয়া কর')}</p><strong>{label('Unavailable','পাওয়া যাচ্ছে না')}</strong></div>
          <p className="life-position__note">{label('A verified assessment and Treasury record are required before an outstanding balance can be shown.','বকেয়া দেখাতে যাচাইকৃত কর নির্ধারণ ও ট্রেজারির তথ্য প্রয়োজন।')}</p>
        </div>
        {data.kind === 'error' && <p className="life-data-notice" role="alert">{label('Protected transaction data could not be loaded. Counts remain unavailable.','সুরক্ষিত লেনদেনের তথ্য লোড হয়নি। সংখ্যা পাওয়া যাচ্ছে না।')} <button type="button" onClick={refresh}>{label('Try again','আবার চেষ্টা করুন')}</button></p>}
        {data.kind === 'loading' && <p className="life-data-notice" role="status">{label('Checking account records…','অ্যাকাউন্টের তথ্য যাচাই হচ্ছে…')}</p>}
        {data.kind === 'disconnected' && <p className="life-data-notice">{label('No account-backed transaction feed is available in this view. Open account access or explore the payment flow.','এই ভিউতে অ্যাকাউন্টভিত্তিক লেনদেনের তথ্য নেই। অ্যাকাউন্টে প্রবেশ করুন বা পেমেন্টের ধাপ দেখুন।')}</p>}
      </section>

      <div className="life-main-grid">
        <section className="life-panel life-journey" aria-labelledby="life-journey-title">
          <div className="life-section-heading">
            <div><p className="life-section-kicker">{label('HOW IT WORKS','কীভাবে কাজ করে')}</p><h2 id="life-journey-title">{label('Your transaction lifecycle','আপনার লেনদেনের জীবনচক্র')}</h2></div>
            <p className="life-note">{label('Process guide · not live tracking','প্রক্রিয়ার নির্দেশিকা · লাইভ ট্র্যাকিং নয়')}</p>
          </div>
          <ol className="life-journey__steps">
            {stages.map(({Icon, title, detail, route}, index) => (
              <li key={route}>
                <button type="button" onClick={() => navigate(route)} aria-label={title + '. ' + detail}>
                  <span className="life-step__index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
                  <span className="life-step__icon"><Icon size={21} aria-hidden="true"/></span>
                  <span className="life-step__content"><strong>{title}</strong><small>{detail}</small></span>
                  <ChevronRight size={17} aria-hidden="true"/>
                </button>
              </li>
            ))}
          </ol>
          <div className="life-journey__foot"><ShieldCheck size={18} aria-hidden="true"/><p>{label('A gateway success alone does not confirm Treasury settlement or create a tax credit.','শুধু গেটওয়ে সফল হলেই ট্রেজারিতে জমা বা কর ক্রেডিট নিশ্চিত হয় না।')}</p></div>
        </section>

        <section className="life-panel life-attention" aria-labelledby="life-attention-title">
          <div className="life-section-heading">
            <div><p className="life-section-kicker">{label('FOLLOW UP','পরবর্তী করণীয়')}</p><h2 id="life-attention-title">{label('Needs your attention','আপনার মনোযোগ প্রয়োজন')}</h2></div>
            <Clock3 size={21} aria-hidden="true"/>
          </div>
          {hasEvidence && (pending.length || exceptions.length) ? (
            <div className="life-attention__items">
              {pending.length > 0 && <button type="button" onClick={() => navigate('history')}><span className="life-attention__marker life-attention__marker--pending"><Clock3 size={19} aria-hidden="true"/></span><span><strong>{pending.length} {label('pending example(s)','অপেক্ষমাণ নমুনা')}</strong><small>{label('Review the transaction status','লেনদেনের অবস্থা দেখুন')}</small></span><ArrowRight size={17} aria-hidden="true"/></button>}
              {exceptions.length > 0 && <button type="button" onClick={() => navigate('history')}><span className="life-attention__marker"><AlertCircle size={19} aria-hidden="true"/></span><span><strong>{exceptions.length} {label('failed / reversed example(s)','ব্যর্থ / ফেরত নমুনা')}</strong><small>{label('Review before starting another attempt','নতুন চেষ্টা করার আগে যাচাই করুন')}</small></span><ArrowRight size={17} aria-hidden="true"/></button>}
            </div>
          ) : <div className="life-attention__empty"><ListChecks size={31} aria-hidden="true"/><h3>{hasEvidence ? label('No flagged examples','কোনো চিহ্নিত নমুনা নেই') : label('Status not connected','অবস্থা সংযুক্ত নয়')}</h3><p>{hasEvidence ? label('No pending, failed or reversed initiated transactions appear in this example data.','নমুনা তথ্যের মধ্যে অপেক্ষমাণ, ব্যর্থ বা ফেরত লেনদেন নেই।') : label('Sign in to a protected simulation profile to review transaction issues.','লেনদেনের সমস্যা দেখতে সুরক্ষিত নমুনা প্রোফাইলে প্রবেশ করুন।')}</p></div>}
          <button type="button" className="life-attention__footer" onClick={() => navigate('corrections')}>{label('View correction requests','সংশোধনের আবেদন দেখুন')}<ArrowRight size={16} aria-hidden="true"/></button>
        </section>

        <section className="life-panel life-activity" aria-labelledby="life-activity-title">
          <div className="life-section-heading">
            <div><p className="life-section-kicker">{label('TRANSACTION HISTORY','লেনদেনের ইতিহাস')}</p><h2 id="life-activity-title">{label('Recent activity','সাম্প্রতিক লেনদেন')}</h2></div>
            <button type="button" className="life-inline-link" onClick={() => navigate('history')}>{label('View all','সব দেখুন')}<ArrowRight size={16} aria-hidden="true"/></button>
          </div>
          <div className="life-activity__toolbar">
            <div role="group" aria-label={label('Transaction perspective','লেনদেন দেখার ধরন')} className="life-segment">
              <button type="button" aria-pressed={perspective === 'payer'} onClick={() => setPerspective('payer')}>{label('I initiated','আমি শুরু করেছি')}</button>
              <button type="button" aria-pressed={perspective === 'beneficiary'} onClick={() => setPerspective('beneficiary')}>{label('Allocated to me','আমার জন্য বরাদ্দ')}</button>
            </div>
            <label className="life-year-select"><CalendarDays size={16} aria-hidden="true"/><span className="sr-only">{label('Assessment year','করবর্ষ')}</span><select value={year} onChange={event => setYear(event.target.value)}><option value="ALL">{label('All years','সব করবর্ষ')}</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          {hasEvidence && recent.length > 0 ? <ul className="life-activity__records">
            {recent.map(item => <li key={item.id}>
              <div className="life-record__icon"><ReceiptText size={20} aria-hidden="true"/></div>
              <div className="life-record__details"><h3>{item.id}</h3><p>{categoriesText(item)} · {item.years.join(', ') || label('Year unverified','করবর্ষ যাচাইকৃত নয়')}</p><p><time dateTime={item.createdAt}>{dateText(item.createdAt)}</time>{item.reviewStatus ? ' · ' + label('Office review','অফিস পর্যালোচনা') + ': ' + item.reviewStatus : ''}</p></div>
              <div className="life-record__amount"><strong>{formatSimulatedAmount(item.amountMinor)}</strong><span className={`life-state life-state--${item.state.toLowerCase()}`}>{stateName(item.state)}</span></div>
            </li>)}
          </ul> : <div className="life-activity__empty"><ReceiptText size={29} aria-hidden="true"/><h3>{label('No transactions to display','দেখানোর মতো লেনদেন নেই')}</h3><p>{hasEvidence ? label('Change the view or assessment year to check other examples.','অন্য নমুনা দেখতে ধরন বা করবর্ষ পরিবর্তন করুন।') : label('Transactions will appear when a permitted data source is available.','অনুমোদিত তথ্যের উৎস সংযুক্ত হলে লেনদেন দেখা যাবে।')}</p></div>}
          <p className="life-activity__disclaimer">{label('Amounts here are simulated allocations, not government receipts or recognized tax credit.','এখানে দেখানো অর্থ নমুনা বরাদ্দ; সরকারি চালান বা স্বীকৃত কর ক্রেডিট নয়।')}</p>
        </section>

        <section className="life-panel life-insights" aria-labelledby="life-signals-title">
          <div className="life-section-heading">
            <div><p className="life-section-kicker">{label('PAYMENT SIGNALS','পেমেন্টের সংকেত')}</p><h2 id="life-signals-title">{label('Transaction status mix','লেনদেনের অবস্থার অনুপাত')}</h2></div>
          </div>
          <p className="life-insights__sub">{perspective === 'payer' ? label('Transactions you initiated','আপনার শুরু করা লেনদেন') : label('Transactions allocated to you','আপনার জন্য বরাদ্দ লেনদেন')} · {year === 'ALL' ? label('All years','সব করবর্ষ') : year}</p>
          <div className="life-status-bars">
            {distribution.map(item => <div className="life-status-bars__row" key={item.state}>
              <div><p>{stateName(item.state)}</p><strong>{hasEvidence ? item.count : '—'}</strong></div>
              <progress className={`life-status-bars__meter life-status-bars__meter--${item.state.toLowerCase()}`} value={hasEvidence ? item.count : 0} max={Math.max(distributionTotal, 1)} aria-label={stateName(item.state)}/>
            </div>)}
          </div>
          <p className="life-insights__sub">{label('Derived only from visible simulation records. Not an NBR settlement report.','শুধুমাত্র দৃশ্যমান নমুনা রেকর্ড থেকে গণনা। এনবিআরের জমার প্রতিবেদন নয়।')}</p>
          <button type="button" className="life-insights__link" onClick={() => navigate('ledger')}><BookOpen size={18} aria-hidden="true"/>{label('Review tax ledger','কর লেজার দেখুন')}<ArrowRight size={17} aria-hidden="true"/></button>
        </section>
      </div>

      <section className="life-services" aria-labelledby="life-tools-title">
        <div className="life-section-heading"><div><p className="life-section-kicker">{label('QUICK ACCESS','দ্রুত প্রবেশ')}</p><h2 id="life-tools-title">{label('Your services','আপনার সেবা')}</h2></div></div>
        <div className="life-services__grid">{tools.map(({Icon,title,sub,route}) => <button type="button" key={route} onClick={() => navigate(route)}><span className="life-services__icon"><Icon size={21} aria-hidden="true"/></span><span className="life-services__copy"><strong>{title}</strong><small>{sub}</small></span><ArrowUpRight size={17} aria-hidden="true"/></button>)}</div>
      </section>
      <details className="citizen-taxpayer-more life-more">
        <summary>{label('More taxpayer services','আরও করদাতা সেবা')}</summary>
        <div>
          {[
            {route:'dashboard',en:'Dashboard',bn:'কর সারসংক্ষেপ',Icon:ListChecks},
            {route:'journey',en:'Tax journey',bn:'করের যাত্রা',Icon:Clock3},
            {route:'account_notifications',en:'Notifications',bn:'বিজ্ঞপ্তি',Icon:Activity},
            {route:'services',en:'Connected services',bn:'সংযুক্ত সেবা',Icon:Layers3}
          ].map(({route,en,bn:bnName,Icon}) => <button type="button" key={route} onClick={() => navigate(route)}>
            <Icon size={18} aria-hidden="true"/><span>{bn ? bnName : en}</span><ArrowRight size={16} aria-hidden="true"/>
          </button>)}
        </div>
      </details>
    </div>
  );
};
