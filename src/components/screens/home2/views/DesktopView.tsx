import { ArrowRight, ArrowUpRight, CalendarCheck, CircleHelp, Download, FilePen, Globe, House, MessageCircle, Receipt, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Slider2 } from '../Slider2'
import { OtherTaxCard } from '../OtherTaxCard'
import { LineArt, type LineArtName } from '../lineArt'
import { Logo, SearchPanel, Tile, type ViewProps, type Home2Action } from '../shared'
const surface = 'rounded-[20px] ring-1 ring-[#e2e5eb]'
const hover = 'transition duration-200 hover:ring-black/10 hover:shadow-[0_12px_28px_-18px_rgba(15,29,52,0.35)]'
export function DesktopView({ c, onToggleLang, onAction, onSearch, signedIn, sliderPaused }: ViewProps) {
  const f = c.features
  const open = (action: Home2Action) => () => onAction(action)
const links=[{action:'status' as const,label:c.links.status,icon:CalendarCheck},{action:'receipts' as const,label:c.links.receipts,icon:FilePen},{action:'security' as const,label:c.links.security,icon:ShieldCheck},{action:'nbr' as const,label:c.links.nbr,icon:ArrowUpRight,external:true}]
return <div className="flex min-h-screen flex-col bg-[#f4f6fa]"><header role="banner" className="home2-v2-type sticky top-0 z-30 border-b border-[#dfe5ee] bg-white/90 backdrop-blur-xl">
 <div className="mx-auto grid h-16 w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center px-8"><Logo />
 <nav aria-label="Primary" className="flex items-center gap-1"><NavLink icon={House} label={c.nav.home} active onClick={open('home')} /><NavLink icon={CircleHelp} label={c.nav.guide} onClick={open('guide')} /><NavLink icon={ShieldAlert} label={c.nav.report} onClick={open('report')} /></nav>
 <div className="flex items-center gap-2 justify-self-end">
 <button onClick={onToggleLang} aria-label={c.langSwitchLabel} className="flex h-10 items-center gap-2 rounded-lg px-3 text-[13.5px] font-semibold text-[#0f1d34] transition hover:bg-[#f4f6fa]"><Globe className="size-4 text-[#5d697e]" /> {c.langSwitch}</button>
 <button onClick={open('login')} className="home2-press flex h-10 items-center gap-1.5 rounded-lg bg-white pr-3.5 pl-4 text-[13.5px] font-semibold text-[#1c3d70] ring-1 ring-[#cad8ef] hover:bg-[#f4f7fc]">{signedIn ? (c.langSwitch === 'English' ? 'ড্যাশবোর্ড' : 'Dashboard') : c.login}<ArrowRight className="size-4" /></button></div></div></header>
<section aria-label={c.section.title} className="mx-auto w-full max-w-[1240px] flex-1 px-8 pt-5 pb-14"><section className="grid grid-cols-[minmax(0,1fr)_clamp(320px,30vw,372px)] gap-3">          {/* Slider 2: existing CMS, Home 2 presentation */}
          <Tile><Slider2 language={c.langSwitch === 'English' ? 'bn' : 'en'} onAction={onAction} paused={sliderPaused}/></Tile>

<div className="home2-v2-type flex flex-col gap-4"><Tile delay={80} className="home2-v2-type relative overflow-hidden rounded-[20px] bg-white p-6 ring-1 ring-[#dfe5ee]">
  <LineArt name="search" accent="#cad8ef" className="absolute top-4 right-4 size-16 text-[#162d53]" />
  <div className="relative pr-20" data-testid="home2-record-heading">
    <h2 className="text-[18px] leading-tight font-bold tracking-[-0.015em]">{c.find.title}</h2>
    <p className="mt-1.5 text-[13px] leading-snug text-[#3e4b62]">{c.find.body}</p>
  </div>
  <div className="relative mt-5"><SearchPanel c={c} onSearch={onSearch} /></div>
</Tile><OtherTaxCard c={c} onAction={onAction} desktop/></div></section>
<section className="home2-v2-type mt-12" aria-labelledby="features-title"><Tile delay={200} className="mb-5 flex items-center justify-between gap-6"><h2 id="features-title" className="min-w-0 text-[28px] leading-tight font-bold tracking-[-0.025em]">{c.section.title}</h2></Tile>
<div className="grid grid-cols-12 grid-rows-[repeat(2,minmax(150px,auto))_minmax(112px,auto)] gap-4"><Tile delay={240} className="col-span-6 row-span-2">
<button onClick={open('pay')} className={"home2-press group relative flex h-full w-full flex-col overflow-hidden bg-white p-7 text-left " + surface + " " + hover}>
 <LineArt name="wallet" accent="#cad8ef" className="absolute top-6 right-6 size-28 text-[#162d53]" />
 <div className="relative flex min-w-0 flex-1 flex-col">
 <div data-testid="home2-all-payments-copy" className="min-h-28 pr-28">
 <h3 className="flex items-center gap-2 text-[26px] leading-tight font-bold tracking-[-0.025em]">{f.all.title} <ArrowUpRight className="size-5 text-[#162d53]/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0f1d34]" /></h3>
 <p className="mt-1.5 max-w-[320px] text-[14px] leading-snug text-[#0f1d34]/75">{f.all.body}</p>
 </div>
 <div className="mt-auto flex flex-wrap gap-1.5 pt-4">{f.all.chips.map(x=><span key={x} className="rounded-md bg-[#edf3fc] px-2.5 py-1 text-[12px] font-medium">{x}</span>)}</div>
 <ol className="mt-5 grid grid-cols-3 gap-2">{f.all.steps.map((step,i)=><li key={step} className="rounded-xl bg-[#edf3fc] p-3.5"><span className="grid size-6 place-items-center rounded-full bg-[#162d53] text-[11px] font-bold text-white">{i+1}</span><span className="mt-2.5 text-[13px] block leading-tight font-semibold">{step}</span></li>)}</ol>
 </div></button></Tile>
 <Tile delay={280} className="col-span-3 row-span-2"><button onClick={open('history')} className={"home2-press group relative flex h-full w-full flex-col overflow-hidden bg-white p-6 text-left " + surface + " " + hover}>
 <LineArt name="receipts" accent="#cfc6b9" className="absolute top-5 right-5 size-16 text-[#162d53]" />
 <div className="relative pr-20">
 <h3 className="text-[18px] leading-tight font-bold tracking-[-0.015em]">{f.history.title}</h3><p className="mt-1.5 text-[13px] leading-snug text-[#3e4b62]">{f.history.body}</p></div>
 <div className="relative mt-auto space-y-1.5 pt-5">{c.taxYears.map(y=><div key={y} aria-hidden="true" className="flex items-center gap-2.5 rounded-lg bg-transparent px-3 py-2.5"><Receipt className="size-4 shrink-0 text-[#5d697e]" aria-hidden /><span className="min-w-0 flex-1 truncate text-[12.5px] text-[#3e4b62]">{f.history.taxYear} <span className="font-semibold text-[#0f1d34]">{y}</span></span><Download className="size-3.5 shrink-0 text-[#5d697e]" aria-hidden /></div>)}</div></button></Tile>
 <MiniTile delay={320} art="certificate" title={f.certs.title} body={f.certs.body} onClick={open('certificates')} tone="bg-white" accent="#b0b1dc" />
<MiniTile delay={360} art="edit" title={f.corrections.title} body={f.corrections.body} onClick={open('corrections')} tone="bg-white" accent="#cfb5b9" />
<WideTile delay={400} art="repeat" title={f.again.title} body={f.again.body} onClick={open('again')} tone="bg-white" accent="#cfc6b9" />
<WideTile delay={440} art="folder" title={f.drafts.title} body={f.drafts.body} onClick={open('drafts')} tone="bg-white" accent="#bad4b9" />
 <WideTile delay={480} art="shield" title={f.secure.title} body={f.secure.body} onClick={open('security')} tone="bg-white" accent="#a5bce1" /></div></section></section>
<footer role="contentinfo" className="home2-v2-type border-t border-[#dfe5ee] bg-white"><div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-5"><div className="flex items-center gap-4"><Logo /><span className="h-8 w-px bg-[#dfe5ee]" aria-hidden /><p className="max-w-[130px] text-[12px] leading-snug text-[#5d697e]">{c.footer.tagline}</p></div><nav aria-label="Footer" className="flex flex-wrap items-center gap-1">{links.map(l=><button key={l.label} onClick={open(l.action)} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium text-[#3e4b62] transition hover:bg-[#f4f6fa] hover:text-[#0f1d34]">{l.label}{l.external&&<ArrowUpRight className="size-3.5" />}</button>)}</nav><div className="text-[12px] text-[#5f6880]"><p>{c.footer.copyright}</p><a href="?action=landing" className="underline" onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onAction('original')}}}>{c.langSwitch === 'English' ? 'মূল পাতা' : 'Original Home'}</a>{' · '}<a href={c.langSwitch === 'English'?'?action=home-3&lang=bn':'?action=home-3'} className="underline">Home 3</a></div>
</div></footer>
<button onClick={open('help')} className="home2-v2-type home2-press fixed right-6 bottom-6 z-30 flex h-11 items-center gap-2 rounded-full bg-white pr-4.5 pl-3.5 text-[13.5px] font-semibold text-[#1c3d70] shadow-[0_10px_28px_-12px_rgba(15,29,52,0.35)] ring-1 ring-[#dfe5ee] hover:bg-[#f4f7fc]"><MessageCircle className="size-[18px]" /> {c.nav.help}</button></div>}
function NavLink({icon:Icon,label,active,onClick}:{icon:LucideIcon;label:string;active?:boolean;onClick:()=>void}){
 return <button onClick={onClick} aria-current={active?'page':undefined} className={"flex h-9 items-center gap-2 rounded-lg px-3.5 text-[14px] font-semibold transition "+(active?"bg-[#f4f7fc] text-[#1c3d70]":"text-[#3e4b62] hover:bg-[#f4f6fa] hover:text-[#0f1d34]")}><Icon className="size-4" /> {label}</button>
}
type TileProps = { art: LineArtName; title: string; body: string; onClick: () => void; tone: string; accent: string; delay: number }
function MiniTile({art,title,body,onClick,tone,accent,delay}:TileProps){
 return <Tile delay={delay} className="col-span-3"><button onClick={onClick} className={"home2-press group relative flex h-full w-full flex-col overflow-hidden p-5 text-left "+surface+" "+tone+" "+hover}>
 <div className="flex items-start justify-between"><LineArt name={art} accent={accent} className="-mt-1 -ml-1 size-14 text-[#162d53]" /><ArrowUpRight className="size-4 text-[#5d697e] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0f1d34]" /></div>
 <h3 className="mt-auto pt-3 text-[16px] leading-tight font-bold tracking-[-0.015em]">{title}</h3><p className="mt-1 text-[12.5px] leading-snug text-[#3e4b62]">{body}</p></button></Tile>
}
function WideTile({art,title,body,onClick,tone,accent,delay}:TileProps){
 return <Tile delay={delay} className="col-span-4"><button onClick={onClick} className={"home2-press group relative flex h-full w-full items-center gap-4 overflow-hidden py-5 pr-5 pl-6 text-left "+surface+" "+hover+" "+tone}><div className="min-w-0 flex-1"><h3 className="flex items-center gap-1.5 text-[16px] leading-tight font-bold tracking-[-0.015em]">{title}<ArrowUpRight className="size-4 shrink-0 text-[#5d697e] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0f1d34]" /></h3><p className="mt-1 text-[12.5px] leading-snug text-[#3e4b62]">{body}</p></div><LineArt name={art} accent={accent} className="size-[68px] shrink-0 text-[#162d53]" /></button></Tile>
}