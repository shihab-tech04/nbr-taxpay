import { createContext, useContext, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import {useTaxState} from '../../../services/taxState'
import {useAccountIdentity} from '../../../services/accountIdentity'
import {PublicHelpChat} from '../../layout/PublicHelpChat'
import './home3.css'
import logo from './assets/logo.png'
import parliament from './assets/parliament.jpg'

type Action = 'home-3'|'landing'|'home-2'|'help'|'login'|'pay'|'history'|'certificates'|'corrections'|'nbr'
type Context = {bn:boolean; signedIn:boolean; toggle:()=>void; act:(action:Action)=>void; search:(reference:string)=>void}
const Home3Context=createContext<Context|null>(null)
function useHome3(){const value=useContext(Home3Context);if(!value)throw new Error('Home 3 context missing');return value}
function ActionLink({action,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{action:Action}){
  const {act,bn,signedIn}=useHome3()
  const fallback=action==='help'?'user_guide':action==='pay'?'head_catalogue':action==='login'?(signedIn?'taxpayer_home':'taxpayer_login'):action==='certificates'&&!signedIn?'verify':action
  const href=action==='nbr'?'https://nbr.gov.bd/':`?action=${fallback}${bn?'&lang=bn':''}`
  return <a {...props} href={href} target={action==='nbr'?'_blank':undefined} rel={action==='nbr'?'noopener noreferrer':undefined} onClick={e=>{if(action==='nbr')return;if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();act(action)}}}>{children}</a>
}
type IconProps = { className?: string }
const Svg = ({ className, children }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)
const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  </Svg>
)
const GlobeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </Svg>
)
const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)
const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
)
const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
const ArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
)
const CardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2.5" />
    <path d="M2 10h20M6 15h4" />
  </Svg>
)
const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
)
const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </Svg>
)
const AwardIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="m9.5 9 1.7 1.7L14.5 7.5" />
    <path d="M8.5 14 7 22l5-3 5 3-1.5-8" />
  </Svg>
)
const EditIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
    <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </Svg>
)
const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
const HeadsetIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" />
    <path d="M18 17v1a3 3 0 0 1-3 3h-3" />
  </Svg>
)
const DocIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M8 10h8M8 14h8M8 18h5" />
  </Svg>
)
const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)
const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

const container = 'mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10'
const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#0a4bb5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff4fb]'

function Brand() {
  const {bn}=useHome3()
  return (
    <ActionLink action="home-3"  aria-label={bn?'সহজকর মূল পাতা':'Sohokor home'} className="flex shrink-0 items-center gap-2 rounded-md">
      <img src={logo} alt="" className="h-9 w-auto lg:h-11" />
      <span className="flex flex-col leading-none text-white">
        <span className="home3-font-bn text-[24px] font-bold tracking-tight lg:text-[28px]">সহজকর</span>
        <span className="-mt-0.5 text-[12px] font-medium tracking-wide lg:text-[13px]">Sohokor</span>
      </span>
    </ActionLink>
  )
}

const Divider = ({ className = '' }: { className?: string }) => (
  <span aria-hidden="true" className={`w-px shrink-0 bg-white/30 ${className}`} />
)

function Header() {
  const [open, setOpen] = useState(false)
  const {bn,toggle,signedIn}=useHome3()
  const t=(en:string,b:string)=>bn?b:en
  return (
    <header className="sticky top-0 z-30 bg-[#01254e] text-white shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className={`${container} flex h-16 items-center gap-5 lg:h-[76px] xl:gap-7`}>
        <Brand />
        <Divider className="hidden h-10 lg:block" />
        <div className="hidden min-w-0 leading-tight lg:block">
          <p className="truncate text-[15px] font-semibold">{t("National Board of Revenue (NBR)","জাতীয় রাজস্ব বোর্ড (এনবিআর)")}</p>
          <p className="truncate text-[11.5px] text-white/75">
            {t("Government of the People's Republic of Bangladesh","গণপ্রজাতন্ত্রী বাংলাদেশ সরকার")}
          </p>
        </div>
        <Divider className="hidden h-10 xl:block" />
        <p className="hidden whitespace-nowrap text-[18px] font-semibold tracking-tight xl:block">
          {t("Tax Payment Management System","কর পরিশোধ ব্যবস্থাপনা সিস্টেম")}
        </p>

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-5 md:flex">
          <ActionLink action="help"  className="flex items-center gap-2 rounded-md text-[15px] text-white/90 transition hover:text-white">
            <HelpIcon className="size-5" /> {t('Help','সহায়তা')}
          </ActionLink>
          <Divider className="h-6" />
          <button type="button" onClick={toggle} className="flex items-center gap-2 rounded-md text-[15px] text-white/90 transition hover:text-white">
            <GlobeIcon className="size-5" />
            <span className="home3-font-bn text-[16px] font-semibold">{bn?'English':'বাংলা'}</span>
            <ChevronDown className="size-4" />
          </button>
          <ActionLink action="login" 
            className="ml-1 flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[15px] font-semibold text-[#01254e] shadow-sm transition hover:bg-blue-50"
          >
            <UserIcon className="size-[18px]" /> {signedIn?t('Account','অ্যাকাউন্ট'):t('Login','লগইন')} <ArrowRight className="size-[18px]" />
          </ActionLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          <ActionLink action="login"  className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[14px] font-semibold text-[#01254e]">
            <UserIcon className="size-4" /> {signedIn?t('Account','অ্যাকাউন্ট'):t('Login','লগইন')}
          </ActionLink>
          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-lg transition hover:bg-white/10"
          >
            {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-white/10 bg-[#01254e] shadow-2xl md:hidden">
          <div className={`${container} py-5`}>
            <p className="text-[15px] font-semibold">{t("National Board of Revenue (NBR)","জাতীয় রাজস্ব বোর্ড (এনবিআর)")}</p>
            <p className="text-[12px] text-white/70">{t("Government of the People's Republic of Bangladesh","গণপ্রজাতন্ত্রী বাংলাদেশ সরকার")}</p>
            <p className="mt-3 text-[16px] font-semibold">{t("Tax Payment Management System","কর পরিশোধ ব্যবস্থাপনা সিস্টেম")}</p>
            <div className="mt-4 divide-y divide-white/10 border-t border-white/10">
              <ActionLink action="help"  className="flex items-center gap-3 py-3.5 text-[15px]">
                <HelpIcon className="size-5" /> {t('Help','সহায়তা')}
              </ActionLink>
              <button type="button" onClick={()=>{toggle();setOpen(false)}} className="flex w-full items-center gap-3 py-3.5 text-[15px]">
                <GlobeIcon className="size-5" />
                <span className="home3-font-bn font-semibold">{bn?'English':'বাংলা'}</span>
                <ChevronDown className="ml-auto size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

const hMask = 'linear-gradient(to right, transparent 0%, #000 30%, #000 100%)'
const vMask = 'linear-gradient(to bottom, transparent 0%, #000 10%, #000 75%, transparent 100%)'
const mobileMask = 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 72%, transparent 100%)'

function Hero() {
  const {bn}=useHome3()
  return (
    <section className="relative">
      <div
        className="pointer-events-none absolute -top-6 right-0 hidden w-[52vw] max-w-[940px] select-none lg:block xl:w-[56vw]"
        style={{ maskImage: hMask, WebkitMaskImage: hMask }}
      >
        <img
          src={parliament}
          alt="Illustration of the National Parliament House of Bangladesh"
          className="w-full"
          style={{ maskImage: vMask, WebkitMaskImage: vMask }}
        />
      </div>
      <div className={`${container} relative`}>
        <div className="max-w-[560px]">
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0b1f44] sm:text-[46px] lg:text-[54px]">
            {bn?'ডিজিটাল পদ্ধতিতে কর':'Pay and Manage'}
            <br />
            {bn?'পরিশোধ ও পরিচালনা করুন':'Your Taxes Digitally'}
          </h1>
          <div className="mt-5 h-1 w-16 rounded-full bg-[#0a4bb5] lg:mt-6" />
          <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-slate-600 sm:text-[18px] lg:mt-6">
            {bn?'জাতীয় রাজস্ব বোর্ডের (এনবিআর) নিরাপদ ও সরকারি কর পরিশোধ পোর্টাল।':'A secure and official payment portal of the National Board of Revenue (NBR).'}
          </p>
        </div>

        <img
          src={parliament}
          alt=""
          className="-mx-5 mt-2 w-[calc(100%+2.5rem)] max-w-none select-none sm:-mx-8 sm:w-[calc(100%+4rem)] lg:hidden"
          style={{ maskImage: mobileMask, WebkitMaskImage: mobileMask }}
        />

        <ActionLink action="pay" 
          className={`group mt-1 flex h-16 w-full items-center gap-5 rounded-xl bg-gradient-to-b from-[#0b52c4] to-[#063f9e] px-6 text-white shadow-[0_12px_28px_-12px_rgba(6,63,158,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(6,63,158,0.8)] sm:w-[380px] lg:mt-8 lg:h-[72px] lg:px-8 ${focusRing}`}
        >
          <CardIcon className="size-8 shrink-0" />
          <span aria-hidden="true" className="h-8 w-px bg-white/40" />
          <span className="text-[22px] font-semibold lg:text-[26px]">{bn?'কর পরিশোধ':'Pay Tax'}</span>
          <ArrowRight className="ml-auto size-7 transition group-hover:translate-x-1" />
        </ActionLink>
      </div>
    </section>
  )
}

function SearchCard() {
  const {bn,search}=useHome3()
  const [reference,setReference]=useState('')
  const [error,setError]=useState(false)
  return (
    <section className={`${container} mt-10 lg:mt-12`}>
      <form
        role="search"
        onSubmit={(e) => {e.preventDefault();if(!reference.trim()){setError(true);return}setError(false);search(reference.trim())}}
        className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,40,90,0.25)] sm:p-6 lg:flex-row lg:items-center lg:gap-8 lg:px-7"
      >
        <div className="flex items-center gap-4 lg:gap-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e6effb] text-[#01254e] lg:size-14">
            <SearchIcon className="size-6 lg:size-7" />
          </div>
          <span aria-hidden="true" className="hidden h-12 w-px bg-slate-200 lg:block" />
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight text-[#0b1f44] lg:text-[20px]">
              {bn?'আপনার পেমেন্ট রেকর্ড খুঁজুন':'Find Your Payment Record'}
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-slate-600 lg:text-[15px]">
              {bn?'চালান, টোকেন বা লেনদেনের রেফারেন্স দিয়ে খুঁজুন।':'Search by Challan, Token or Transaction Reference.'}
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2.5">
          <label className="sr-only" htmlFor="home3-ref">
            {bn?'চালান, টোকেন বা লেনদেনের রেফারেন্স':'Challan, token or transaction reference'}
          </label>
          <input
            id="home3-ref"
            value={reference} onChange={e=>{setReference(e.target.value);setError(false)}} maxLength={120} aria-invalid={error} aria-describedby={error?'home3-ref-error':undefined}
            autoComplete="off"
            placeholder={bn?'চালান, টোকেন বা লেনদেনের রেফারেন্স লিখুন':'Enter Challan, Token or Transaction Reference'}
            className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-[15px] text-[#0b1f44] outline-none transition placeholder:text-slate-400 focus:border-[#0a4bb5] focus:ring-4 focus:ring-[#0a4bb5]/15"
          />
          <button
            type="submit"
            aria-label={bn?'খুঁজুন':'Search'}
            className={`grid size-12 shrink-0 place-items-center rounded-lg bg-[#0a4bb5] text-white transition hover:bg-[#083f9a] ${focusRing}`}
          >
            <SearchIcon className="size-5" />
          </button>
        </div>
      </form>
      {error&&<p id="home3-ref-error" role="alert" className="mt-2 text-sm text-red-700">{bn?'রেফারেন্স লিখুন।':'Enter a payment reference.'}</p>}
    </section>
  )
}

const services = [
  { icon: ClockIcon, action:'history' as const, title: 'Payment History', titleBn:'পেমেন্টের ইতিহাস', desc: 'View past payments and receipts.', descBn:'আগের পেমেন্ট ও রসিদ দেখুন।' },
  { icon: AwardIcon, action:'certificates' as const, title: 'Tax Certificates', titleBn:'কর সনদ', desc: 'Find and download tax certificates.', descBn:'কর সনদ খুঁজুন ও ডাউনলোড করুন।' },
  { icon: EditIcon, action:'corrections' as const, title: 'Corrections & Requests', titleBn:'সংশোধন ও আবেদন', desc: 'Submit a request and track progress.', descBn:'আবেদন করুন ও অগ্রগতি দেখুন।' },
]

function Services() {
  const {bn}=useHome3()
  return (
    <section aria-label="Services" className={`${container} mt-4 grid gap-4 md:grid-cols-3 lg:mt-5 lg:gap-5`}>
      {services.map(({ icon: Icon, action, title, titleBn, desc, descBn }) => (
        <ActionLink action={action} key={title}
          
          className={`group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(15,40,90,0.25)] transition hover:-translate-y-0.5 hover:border-[#0a4bb5]/30 hover:shadow-[0_14px_30px_-16px_rgba(15,40,90,0.35)] lg:p-6 ${focusRing}`}
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6effb] text-[#0a4bb5] transition group-hover:bg-[#0a4bb5] group-hover:text-white">
            <Icon className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold leading-tight text-[#0b1f44] lg:text-[17px]">{bn?titleBn:title}</h3>
            <p className="mt-1 text-[13.5px] leading-snug text-slate-600 lg:text-[14px]">{bn?descBn:desc}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0a4bb5]" />
        </ActionLink>
      ))}
    </section>
  )
}

function Footer() {
  const {bn}=useHome3()
  return (
    <footer className="border-t border-slate-200/90 bg-white/40">
      <div className={`${container} flex flex-col gap-4 py-6 text-[14px] text-[#0b1f44] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8 lg:flex-nowrap`}>
        <p className="flex items-center gap-2.5 font-semibold">
          <ShieldIcon className="size-5 shrink-0 text-[#01254e]" /> {bn?'এনবিআরের নিরাপদ ও সরকারি সেবা':'A secure and official service of NBR'}
        </p>
        <div className="flex items-center gap-6">
          <ActionLink action="help"  className="flex items-center gap-2 rounded-md transition hover:text-[#0a4bb5]">
            <HeadsetIcon className="size-5" /> {bn?'সহায়তা':'Support'}
          </ActionLink>
          <span aria-hidden="true" className="h-5 w-px bg-slate-300" />
          <ActionLink action="nbr"  className="flex items-center gap-2 rounded-md transition hover:text-[#0a4bb5]">
            <DocIcon className="size-5" /> {bn?'এনবিআর প্রকাশনা':'NBR Publications'} <ArrowUpRight className="size-3.5" />
          </ActionLink>
        </div>
        <p className="text-[13px] text-slate-500">{bn?'© ২০২৬ জাতীয় রাজস্ব বোর্ড (এনবিআর)':'© 2026 National Board of Revenue (NBR)'} <span className="block text-center"><ActionLink action="landing" className="underline">{bn?'মূল পাতা':'Original Home'}</ActionLink>{' · '}<ActionLink action="home-2" className="underline">Home 2</ActionLink></span></p>
      </div>
    </footer>
  )
}

export function Home3Layout({onSearch}:{onSearch:(reference:string)=>void}) {
  const {language,setLanguage,navigate,openAllTaxPayments,previewAccount}=useTaxState()
  const {user}=useAccountIdentity()
  const signedIn=Boolean(user||previewAccount)
  const [helpRequest,setHelpRequest]=useState(0)
  const helpTrigger=useRef<HTMLElement|null>(null)
  const act=(action:Action)=>{
    const origin={fromHome3:true}
    switch(action){
      case 'pay':openAllTaxPayments();break;
      case 'help':helpTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setHelpRequest(n=>n+1);break;
      case 'login':navigate(signedIn?'taxpayer_home':'taxpayer_login',origin);break;
      case 'certificates':navigate(signedIn?'certificates':'verify',origin);break;
      case 'history':case 'corrections':navigate(action,origin);break;
      case 'nbr':break;
      default:navigate(action);break;
    }
  }
  return <Home3Context.Provider value={{bn:language==='bn',signedIn,toggle:()=>setLanguage(language==='en'?'bn':'en'),act,search:onSearch}}>
    <div className="home3-import-root" lang={language} data-testid="home3-root">
    <div data-home2-view data-home3-view>
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-[#f4f7fc] via-[#eff4fb] to-[#f3f6fc]">
      <Header />
      <div className="flex flex-1 flex-col justify-center overflow-x-clip py-8 lg:py-14">
        <Hero />
        <SearchCard />
        <Services />
      </div>
      <Footer />
    </div>
    </div>
    <PublicHelpChat externalOpenRequest={helpRequest} externalTrigger={helpTrigger} hideLauncher/>
    </div>
  </Home3Context.Provider>
}
