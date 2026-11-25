import { createContext, lazy, Suspense, useContext, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import {useTaxState} from '../../../services/taxState'
import {useAccountIdentity} from '../../../services/accountIdentity'
import {PublicHelpChat} from '../../layout/PublicHelpChat'
import './home3.css'
import logo from './assets/nbr-logo.png'
import parliament from './assets/parliament.jpg'

const GiftTaxEntryModal=lazy(()=>import('../GiftTaxEntryModal').then(m=>({default:m.GiftTaxEntryModal})))

type Action = 'home-3'|'landing'|'home-2'|'help'|'login'|'pay'|'history'|'certificates'|'corrections'|'nbr'|'gift'|'travel'|'search'
type Context = {bn:boolean; signedIn:boolean; toggle:()=>void; act:(action:Action)=>void; search:(reference:string)=>void}
const Home3Context=createContext<Context|null>(null)
function useHome3(){const value=useContext(Home3Context);if(!value)throw new Error('Home 3 context missing');return value}
function ActionLink({action,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{action:Action}){
  const {act,bn,signedIn}=useHome3()
  const fallback=action==='search'?'verify':action==='gift'?'head_catalogue':action==='travel'?'travel':action==='help'?'user_guide':action==='pay'?'head_catalogue':action==='login'?(signedIn?'taxpayer_home':'taxpayer_login'):action==='certificates'&&!signedIn?'verify':action
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
const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </Svg>
)
const PlaneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
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

const container = 'mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-10'
const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#0a4bb5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff4fb]'
const cardBase =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_-16px_rgba(15,40,90,0.25)]'
const cardHover =
  'transition hover:-translate-y-0.5 hover:border-[#0a4bb5]/30 hover:shadow-[0_14px_30px_-16px_rgba(15,40,90,0.35)]'

function Brand() {
  const {bn}=useHome3()
  return (
    <ActionLink action="home-3" aria-label={bn?"জাতীয় রাজস্ব বোর্ড মূল পাতা":"National Board of Revenue home"} className="flex min-w-0 items-center gap-2.5 rounded-md">
      <img src={logo} alt="" className="size-9 shrink-0 rounded-full lg:size-11" />
      <span className="flex min-w-0 flex-col leading-tight text-white">
        <span className="truncate home3-font-bn text-[15px] font-bold lg:text-[19px]">জাতীয় রাজস্ব বোর্ড (এনবিআর)</span>
        <span className="truncate text-[11px] font-medium text-white/85 lg:text-[13px]">National Board of Revenue (NBR)</span>
      </span>
    </ActionLink>
  )
}

const Divider = ({ className = '' }: { className?: string }) => (
  <span aria-hidden="true" className={`w-px shrink-0 bg-white/30 ${className}`} />
)

function LanguageButton({ className = '', onToggle }: { className?: string; onToggle?:()=>void }) {
  const {bn,toggle}=useHome3()
  return (
    <button type="button" onClick={()=>{toggle();onToggle?.()}} className={`flex items-center gap-1.5 rounded-md text-white/90 transition hover:text-white ${className}`}>
      <GlobeIcon className="size-5" />
      <span className="home3-font-bn text-[15px] font-semibold lg:text-[16px]">{bn?"English":"বাংলা"}</span>
      <ChevronDown className="size-4" />
    </button>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  const {bn,signedIn}=useHome3()
  const t=(en:string,b:string)=>bn?b:en
  return (
    <header className="sticky top-0 z-30 bg-[#01254e] text-white">
      <div className={`${container} flex h-16 items-center gap-3 lg:h-[76px] lg:gap-7`}>
        <Brand />
        <Divider className="hidden h-10 lg:block" />
        <p className="hidden whitespace-nowrap text-[19px] font-semibold tracking-tight lg:block">
          {t("Tax Payment Management System","কর পরিশোধ ব্যবস্থাপনা সিস্টেম")}
        </p>

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-5 md:flex">
          <ActionLink action="help" className="flex items-center gap-2 rounded-md text-[15px] text-white/90 transition hover:text-white">
            <HelpIcon className="size-5" /> {t("Help","সহায়তা")}
          </ActionLink>
          <Divider className="h-6" />
          <LanguageButton />
          <ActionLink
            action="login"
            className="ml-1 flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[15px] font-semibold text-[#01254e] shadow-sm transition hover:bg-blue-50"
          >
            <UserIcon className="size-[18px]" /> {signedIn?t("Account","অ্যাকাউন্ট"):t("Login","লগইন")} <ArrowRight className="size-[18px]" />
          </ActionLink>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 md:hidden">
          <Divider className="h-8" />
          <LanguageButton className="hidden min-[380px]:flex" />
          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="-mr-2 grid size-10 place-items-center rounded-lg transition hover:bg-white/10"
          >
            {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-white/10 bg-[#01254e] shadow-2xl md:hidden">
          <div className={`${container} py-5`}>
            <p className="text-[16px] font-semibold">{t("Tax Payment Management System","কর পরিশোধ ব্যবস্থাপনা সিস্টেম")}</p>
            <div className="mt-3 divide-y divide-white/10 border-t border-white/10">
              <ActionLink action="help" className="flex items-center gap-3 py-3.5 text-[15px]">
                <HelpIcon className="size-5" /> {t("Help","সহায়তা")}
              </ActionLink>
              <LanguageButton className="w-full py-3.5 min-[380px]:hidden" onToggle={()=>setOpen(false)} />
            </div>
            <ActionLink
              action="login"
              className="mt-3 flex h-11 items-center justify-center gap-2 rounded-lg bg-white text-[15px] font-semibold text-[#01254e]"
            >
              <UserIcon className="size-[18px]" /> {signedIn?t("Account","অ্যাকাউন্ট"):t("Login","লগইন")} <ArrowRight className="size-[18px]" />
            </ActionLink>
          </div>
        </div>
      )}
    </header>
  )
}

const hMask = 'linear-gradient(to right, transparent 0%, #000 28%, #000 100%)'
const vMask = 'linear-gradient(to bottom, transparent 0%, #000 8%, #000 70%, transparent 100%)'
const mobileMask = 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 70%, transparent 100%)'

const secondaryPayments = [
  { icon: GiftIcon, label: 'Gift Tax', labelBn:'দানকর', action:'gift' as const },
  { icon: PlaneIcon, label: 'Travel Tax', labelBn:'ভ্রমণ কর', action:'travel' as const },
]

function Hero() {
  const {bn}=useHome3()
  return (
    <section className="relative">
      {/* Soft diagonal light beams behind the hero */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[18%] h-[720px] w-40 rotate-[35deg] bg-gradient-to-b from-white/70 to-transparent blur-sm" />
        <div className="absolute -top-40 right-[6%] h-[640px] w-24 rotate-[35deg] bg-gradient-to-b from-teal-100/50 to-transparent blur-sm" />
      </div>

      <div
        className="pointer-events-none absolute -top-4 right-0 hidden w-[50vw] max-w-[900px] select-none lg:block xl:w-[52vw]"
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
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0b1f44] sm:text-[44px] lg:text-[54px]">
            {bn?"ডিজিটাল পদ্ধতিতে কর":"Pay and Manage"}
            <br />
            {bn?"পরিশোধ ও পরিচালনা করুন":"Your Taxes Digitally"}
          </h1>
          <div className="mt-4 h-1 w-14 rounded-full bg-[#0a4bb5] lg:mt-6 lg:w-16" />
          <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-slate-700 sm:text-[18px] lg:mt-6">
            {bn?"জাতীয় রাজস্ব বোর্ডের (এনবিআর) নিরাপদ ও সরকারি কর পরিশোধ পোর্টাল।":"A secure and official payment portal of the National Board of Revenue (NBR)."}
          </p>
        </div>

        <img
          src={parliament}
          alt=""
          className="-mx-4 -mt-6 w-[calc(100%+2rem)] max-w-none select-none sm:-mx-8 sm:w-[calc(100%+4rem)] lg:hidden"
          style={{ maskImage: mobileMask, WebkitMaskImage: mobileMask }}
        />

        <div className="-mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:mt-9 lg:gap-6">
          <ActionLink
            action="pay"
            className={`group flex h-14 items-center gap-4 rounded-xl bg-gradient-to-b from-[#0b52c4] to-[#063f9e] px-5 text-white shadow-[0_12px_28px_-12px_rgba(6,63,158,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(6,63,158,0.8)] sm:h-[68px] sm:w-[380px] sm:px-7 ${focusRing}`}
          >
            <CardIcon className="size-7 shrink-0 sm:size-8" />
            <span className="text-[20px] font-semibold sm:text-[24px]">{bn?"আয়কর পরিশোধ":"Pay Income Tax"}</span>
            <ArrowRight className="ml-auto size-6 transition group-hover:translate-x-1 sm:size-7" />
          </ActionLink>

          <span aria-hidden="true" className="hidden h-12 w-px bg-slate-300 lg:block" />

          <div className="grid grid-cols-2 gap-3 sm:flex lg:gap-5">
            {secondaryPayments.map(({ icon: Icon, label,labelBn,action }) => (
              <ActionLink
                key={label}
                action={action}
                className={`group flex h-[68px] items-center gap-3 border-blue-100 px-3 sm:min-w-[200px] sm:px-4 ${cardBase} ${cardHover} ${focusRing}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e6effb] text-[#0a4bb5]">
                  <Icon className="size-6" />
                </span>
                <span className="text-[15px] font-semibold leading-[1.2] text-[#0b1f44] sm:text-[16px]">
                  {bn?"পরিশোধ":"Pay"}
                  <br />
                  {bn?labelBn:label}
                </span>
                <ArrowRight className="ml-auto size-5 shrink-0 text-[#0a4bb5] transition group-hover:translate-x-0.5" />
              </ActionLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function IconTile({ icon: Icon }: { icon: (p: IconProps) => ReactNode }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6effb] text-[#0a4bb5] transition group-hover:bg-[#0a4bb5] group-hover:text-white lg:size-12">
      <Icon className="size-6" />
    </span>
  )
}

function SearchCard() {
  const {bn,search}=useHome3()
  const [reference,setReference]=useState('')
  const [error,setError]=useState(false)
  const t=(en:string,b:string)=>bn?b:en
  return (
    <section className={`${container} mt-4 sm:mt-10 lg:mt-12`}>
      {/* Mobile: compact entry point */}
      <ActionLink action="search" className={`group flex items-center gap-4 p-4 sm:hidden ${cardBase} ${focusRing}`}>
        <IconTile icon={SearchIcon} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-tight text-[#0b1f44]">{t("Find Your Payment Record","আপনার পেমেন্ট রেকর্ড খুঁজুন")}</span>
          <span className="mt-1 block text-[13px] leading-snug text-slate-600">
            {t("Search by Challan, Token or Transaction Reference.","চালান, টোকেন বা লেনদেনের রেফারেন্স দিয়ে খুঁজুন।")}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-500" />
      </ActionLink>

      {/* Tablet & desktop: inline search */}
      <form
        role="search"
        onSubmit={(e)=>{e.preventDefault();if(!reference.trim()){setError(true);return}setError(false);search(reference.trim())}}
        className={`hidden flex-col gap-5 p-6 sm:flex lg:flex-row lg:items-center lg:gap-8 lg:px-7 ${cardBase}`}
      >
        <div className="flex items-center gap-4 lg:gap-5">
          <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#e6effb] text-[#01254e]">
            <SearchIcon className="size-7" />
          </div>
          <span aria-hidden="true" className="hidden h-12 w-px bg-slate-200 lg:block" />
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold leading-tight text-[#0b1f44] lg:text-[20px]">{t("Find Your Payment Record","আপনার পেমেন্ট রেকর্ড খুঁজুন")}</h2>
            <p className="mt-1 text-[14px] leading-snug text-slate-600 lg:text-[15px]">
              {t("Search by Challan, Token or Transaction Reference.","চালান, টোকেন বা লেনদেনের রেফারেন্স দিয়ে খুঁজুন।")}
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2.5">
          <label className="sr-only" htmlFor="home3-ref">
            {t("Challan, token or transaction reference","চালান, টোকেন বা লেনদেনের রেফারেন্স")}
          </label>
          <input
            id="home3-ref"
            value={reference} onChange={e=>{setReference(e.target.value);setError(false)}} maxLength={120} aria-invalid={error} aria-describedby={error?"home3-ref-error":undefined}
            autoComplete="off"
            placeholder={t("Enter Challan, Token or Transaction Reference","চালান, টোকেন বা লেনদেনের রেফারেন্স লিখুন")}
            className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-[15px] text-[#0b1f44] outline-none transition placeholder:text-slate-400 focus:border-[#0a4bb5] focus:ring-4 focus:ring-[#0a4bb5]/15"
          />
          <button
            type="submit"
            aria-label={t("Search","খুঁজুন")}
            className={`grid size-12 shrink-0 place-items-center rounded-lg bg-[#0a4bb5] text-white transition hover:bg-[#083f9a] ${focusRing}`}
          >
            <SearchIcon className="size-5" />
          </button>
        </div>
      </form>
      {error&&<p id="home3-ref-error" role="alert" className="mt-2 text-sm text-red-700">{t("Enter a payment reference.","রেফারেন্স লিখুন।")}</p>}
    </section>
  )
}

const services = [
  { icon: ClockIcon, action:'history' as const, title: 'Payment History', titleBn:'পেমেন্টের ইতিহাস', descBn:'আগের পেমেন্ট ও রসিদ দেখুন।', desc: 'View past payments and receipts.' },
  { icon: AwardIcon, action:'certificates' as const, title: 'Tax Certificates', titleBn:'কর সনদ', descBn:'কর সনদ খুঁজুন ও ডাউনলোড করুন।', desc: 'Find and download tax certificates.' },
  { icon: EditIcon, action:'corrections' as const, title: 'Corrections & Requests', titleBn:'সংশোধন ও আবেদন', descBn:'আবেদন করুন ও অগ্রগতি দেখুন।', desc: 'Submit a request and track progress.' },
]

function Services() {
  const {bn}=useHome3()
  return (
    <section aria-label="Services" className={`${container} mt-3 grid gap-2.5 sm:mt-4 sm:gap-4 lg:mt-5 lg:grid-cols-3 lg:gap-6`}>
      {services.map(({ icon, action, title, titleBn, desc, descBn }) => (
        <ActionLink key={title} action={action} className={`group flex items-center gap-4 p-4 lg:p-6 ${cardBase} ${cardHover} ${focusRing}`}>
          <IconTile icon={icon} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold leading-tight text-[#0b1f44] lg:text-[18px]">{bn?titleBn:title}</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-600 lg:text-[14.5px]">{bn?descBn:desc}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[#0a4bb5]" />
        </ActionLink>
      ))}
    </section>
  )
}

function Footer() {
  const {bn}=useHome3()
  return (
    <footer className="border-t border-slate-200/90 bg-white/50">
      <div className={`${container} flex flex-col gap-4 py-6 text-[14px] text-[#0b1f44] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8 lg:flex-nowrap lg:text-[15px]`}>
        <p className="flex items-center gap-2.5 font-medium">
          <ShieldIcon className="size-5 shrink-0 text-[#01254e]" /> {bn?"এনবিআরের নিরাপদ ও সরকারি সেবা":"A secure and official service of NBR"}
        </p>
        <div className="flex items-center gap-6">
          <ActionLink action="help" className="flex items-center gap-2 rounded-md transition hover:text-[#0a4bb5]">
            <HeadsetIcon className="size-5" /> {bn?"সহায়তা":"Support"}
          </ActionLink>
          <span aria-hidden="true" className="h-5 w-px bg-slate-300" />
          <ActionLink action="nbr" className="flex items-center gap-2 rounded-md transition hover:text-[#0a4bb5]">
            <DocIcon className="size-5" /> {bn?"এনবিআর প্রকাশনা":"NBR Publications"} <ArrowUpRight className="size-3.5" />
          </ActionLink>
        </div>
        <p className="text-[13px] text-slate-600 lg:text-[14px]">{bn?"© ২০২৬ জাতীয় রাজস্ব বোর্ড (এনবিআর)":"© 2026 National Board of Revenue (NBR)"} <span className="block text-center"><ActionLink action="landing" className="underline">{bn?"মূল পাতা":"Original Home"}</ActionLink>{" · "}<ActionLink action="home-2" className="underline">Home 2</ActionLink></span></p>
      </div>
    </footer>
  )
}

export function Home3Layout({onSearch,onService}:{onSearch:(reference:string)=>void;onService:(service:"travel")=>void}) {
  const {language,setLanguage,navigate,openAllTaxPayments,previewAccount}=useTaxState()
  const {user}=useAccountIdentity()
  const signedIn=Boolean(user||previewAccount)
  const [helpRequest,setHelpRequest]=useState(0)
  const [giftOpen,setGiftOpen]=useState(false)
  const helpTrigger=useRef<HTMLElement|null>(null)
  const act=(action:Action)=>{
    const origin={fromHome3:true}
    switch(action){
      case 'pay':openAllTaxPayments();break;
      case 'gift':setGiftOpen(true);break;
      case 'travel':onService(action);break;
      case 'search':onSearch('');break;
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
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-[#f4f8fd] via-[#eff4fb] to-[#f3f6fc]">
      <Header />
      <div className="flex flex-1 flex-col justify-center overflow-x-clip py-6 lg:py-14">
        <Hero />
        <SearchCard />
        <Services />
      </div>
      <Footer />
    </div>
    </div>
    {giftOpen&&<Suspense fallback={<p role="status">{language==='bn'?'দানকর লোড হচ্ছে…':'Loading Gift Tax…'}</p>}><GiftTaxEntryModal signedIn={signedIn} onClose={()=>setGiftOpen(false)}/></Suspense>}
    <PublicHelpChat externalOpenRequest={helpRequest} externalTrigger={helpTrigger} hideLauncher/>
    </div>
  </Home3Context.Provider>
}
