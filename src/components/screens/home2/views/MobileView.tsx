import { ArrowRight, ArrowUpRight, CalendarCheck, ChevronRight, CircleHelp, Download, FilePen, Globe, House, MessageCircle, ShieldAlert, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react'
import { Slider2 } from '../Slider2'
import { LineArt, type LineArtName } from '../lineArt'
import { Logo, SearchPanel, Tile, type ViewProps, type Home2Action } from '../shared'
const surface = 'rounded-[20px] ring-1 ring-black/[0.05]'
export function MobileView({ c, onToggleLang, onAction, onSearch, signedIn, sliderPaused }: ViewProps) {
  const f = c.features
  const open = (action: Home2Action) => () => onAction(action)
const links=[{action:'status' as const,label:c.links.status,icon:CalendarCheck},{action:'receipts' as const,label:c.links.receipts,icon:FilePen},{action:'security' as const,label:c.links.security,icon:ShieldCheck},{action:'nbr' as const,label:c.links.nbr,icon:ArrowUpRight,external:true}]
return <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f4f6fa] pb-24 shadow-[0_0_60px_-20px_rgba(15,29,52,0.25)]"><header role="banner" className="home2-v2-type sticky top-0 z-30 flex items-center justify-between border-b border-[#dfe5ee] bg-white/90 px-4 py-2.5 backdrop-blur-xl">
 <Logo />

 <div className="flex items-center gap-1.5">
 <button onClick={onToggleLang} aria-label={c.langSwitchLabel} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-[#0f1d34]"><Globe className="size-[15px] text-[#5d697e]" /> {c.langSwitch}</button>
 <button onClick={open('login')} className="home2-press flex h-9 items-center gap-1 rounded-lg bg-white pr-2.5 pl-3 text-[12.5px] font-semibold text-[#1c3d70] ring-1 ring-[#cad8ef]">{signedIn ? (c.langSwitch === 'English' ? 'ড্যাশবোর্ড' : 'Dashboard') : c.login}<ArrowRight className="size-[15px]" /></button></div></header><section aria-label={c.section.title} className="space-y-3 px-4 pt-3">        {/* Slider 2: existing CMS, Home 2 presentation */}
          <Tile><Slider2 language={c.langSwitch === 'English' ? 'bn' : 'en'} onAction={onAction} paused={sliderPaused}/></Tile>

<Tile delay={80} className="home2-v2-type relative overflow-hidden rounded-[20px] bg-[#f4f7fc] p-5 ring-1 ring-[#e6edf8]">
  <LineArt name="search" accent="#cad8ef" className="absolute top-4 right-4 size-14 text-[#162d53]" />
  <div className="relative pr-16">
    <h2 className="text-[17px] leading-tight font-bold tracking-[-0.015em]">{c.find.title}</h2>
    <p className="mt-1 text-[12.5px] leading-snug text-[#3e4b62]">{c.find.body}</p>
  </div>
  <div className="relative mt-4"><SearchPanel c={c} onSearch={onSearch} /></div>
</Tile><div className="home2-v2-type space-y-3"><Tile delay={140} className="px-1 pt-4 pb-1"><p className="text-[11px] font-semibold tracking-[0.08em] text-[#244d8f] uppercase">{c.section.eyebrow}</p><h2 className="mt-1 text-[22px] leading-tight font-bold tracking-[-0.025em]">{c.section.title}</h2><p className="mt-0.5 text-[12.5px] text-[#3e4b62]">{c.section.body}</p></Tile>
<div className="grid grid-cols-2 gap-3"><Tile delay={180} className="col-span-2">
<button onClick={open('pay')} className={"home2-press relative block w-full overflow-hidden bg-[#a5bce1] p-5 text-left " + surface}>
 <LineArt name="wallet" accent="#cad8ef" className="absolute top-4 right-4 size-20 text-[#162d53]" />
 <span className="relative inline-flex rounded-md bg-white/70 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.04em] uppercase">{f.all.badge}</span>

 <h3 className="relative mt-5 flex items-center gap-1.5 text-[20px] leading-tight font-bold tracking-[-0.02em]">{f.all.title} <ArrowUpRight className="size-4 text-[#162d53]/50" /></h3>
 <p className="relative mt-1 max-w-[230px] text-[12.5px] leading-snug text-[#0f1d34]/75">{f.all.body}</p>
 <div className="relative mt-3 flex flex-wrap gap-1.5">{f.all.chips.map(x=><span key={x} className="rounded-md bg-white/70 px-2 py-0.5 text-[11.5px] font-medium">{x}</span>)}</div>
 <ol className="relative mt-4 grid grid-cols-3 gap-1.5">{f.all.steps.map((step,i)=><li key={step} className="rounded-xl bg-white/75 p-2.5"><span className="grid size-5 place-items-center rounded-full bg-[#162d53] text-[10px] font-bold text-white">{i+1}</span><span className="mt-2 text-[11.5px] block leading-tight font-semibold">{step}</span></li>)}</ol>
 </button></Tile>
 <Tile delay={220} className="row-span-2"><button onClick={open('history')} className={"home2-press relative flex h-full w-full flex-col overflow-hidden bg-[#e3ddd4] p-4 text-left " + surface}>
 <LineArt name="receipts" accent="#cfc6b9" className="-mt-1 -ml-1 size-14 text-[#162d53]" />

 <h3 className="mt-2.5 text-[15px] leading-tight font-bold tracking-[-0.015em]">{f.history.title}</h3><p className="mt-1 text-[11.5px] leading-snug text-[#3e4b62]">{f.history.body}</p>
 <div className="mt-auto space-y-1.5 pt-3">{c.taxYears.slice(0,3).map(y=><div key={y} aria-hidden="true" className="flex items-center justify-between rounded-lg bg-white/75 px-2.5 py-1.5"><span className="text-[11.5px] font-semibold">{y}</span><Download className="size-3.5 shrink-0 text-[#5d697e]" aria-hidden /></div>)}</div></button></Tile>
 <MiniTile delay={260} art="certificate" title={f.certs.title} body={f.certs.short} onClick={open('certificates')} tone="bg-[#cecfeb]" accent="#b0b1dc" />
<MiniTile delay={300} art="edit" title={f.corrections.title} body={f.corrections.short} onClick={open('corrections')} tone="bg-[#e3d2d4]" accent="#cfb5b9" />
<MiniTile delay={340} art="repeat" title={f.again.title} body={f.again.short} onClick={open('again')} tone="bg-[#cce4eb]" accent="#acd0dc" />
<MiniTile delay={380} art="folder" title={f.drafts.title} body={f.drafts.short} onClick={open('drafts')} tone="bg-[#d5e6d4]" accent="#bad4b9" />
 <Tile delay={420} className="col-span-2"><button onClick={open('security')} className={"home2-press relative flex w-full items-center gap-3 overflow-hidden bg-[#cad8ef] p-4 text-left " + surface}><LineArt name="shield" accent="#a5bce1" className="size-12 shrink-0 text-[#162d53]" /><div className="min-w-0 flex-1"><h3 className="text-[14.5px] leading-tight font-bold">{f.secure.title}</h3><p className="mt-0.5 text-[12px] leading-snug text-[#3e4b62]">{f.secure.body}</p></div><ChevronRight className="size-4 shrink-0 text-[#5d697e]" /></button></Tile><Tile delay={460} className="col-span-2"><div className={"relative overflow-hidden bg-[#cce4eb] p-5 " + surface}>
 <LineArt name="guide" accent="#acd0dc" className="absolute top-4 right-4 size-14 text-[#162d53]" />
 <div className="relative pr-16"><h3 className="text-[16px] leading-tight font-bold tracking-[-0.015em]">{c.help.title}</h3><p className="mt-1 text-[12.5px] leading-snug text-[#3e4b62]">{c.help.body}</p></div>
 <div className="relative mt-4 grid grid-cols-2 gap-2">
   <button data-testid="home2-guide-action" onClick={open('guide')} className="home2-press flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-semibold ring-1 ring-black/5 hover:bg-white/80">{c.help.guide} <ArrowRight className="size-4 shrink-0" /></button>
   <button data-testid="home2-chat-action" onClick={open('help')} className="home2-press flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-white/50 text-[13px] font-semibold ring-1 ring-black/5 hover:bg-white/80"><MessageCircle className="size-4 shrink-0" /> {c.help.chat}</button>
 </div>
</div></Tile></div>
<Tile delay={500} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[#dfe5ee]">{links.map((l,i)=><button key={l.label} onClick={open(l.action)} className={"flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-[#f4f6fa] "+(i?"border-t border-[#dfe5ee]":"")}><l.icon className="size-[18px] text-[#5d697e]" /><span className="flex-1 text-[13.5px] font-semibold">{l.label}</span>{l.external?<ArrowUpRight className="size-4 text-[#5d697e]/70" />:<ChevronRight className="size-4 text-[#5d697e]/70" />}</button>)}</Tile>
<footer role="contentinfo" className="flex flex-col items-center gap-2 pt-4 pb-1 text-center"><Logo /><p className="text-[11.5px] text-[#5d697e]">{c.footer.tagline} · {c.footer.copyright}</p><div className="flex items-center justify-center gap-2 text-[11.5px] text-[#5f6880]"><a href="?action=landing" className="text-[11.5px] text-[#5f6880] underline" onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onAction('original')}}}>{c.langSwitch === 'English' ? 'মূল পাতা' : 'Original Home'}</a><span aria-hidden="true">·</span><a href={c.langSwitch === 'English'?'?action=home-3&lang=bn':'?action=home-3'} className="underline">Home 3</a></div>
</footer></div></section>
<nav aria-label={c.nav.home} className="home2-v2-type fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-[#dfe5ee] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-xl"><div className="flex h-[58px] items-center justify-around"><NavItem icon={House} label={c.nav.home} active onClick={open('home')} /><NavItem icon={Wallet} label={c.payTax} onClick={open('pay')} /><NavItem icon={CircleHelp} label={c.nav.guideShort} onClick={open('guide')} /><NavItem icon={ShieldAlert} label={c.nav.report} onClick={open('report')} /><NavItem icon={MessageCircle} label={c.nav.help} onClick={open('help')} /></div></nav></div>}
type TileProps = { art: LineArtName; title: string; body: string; onClick: () => void; tone: string; accent: string; delay: number }
function MiniTile({art,title,body,onClick,tone,accent,delay}:TileProps){
 return <Tile delay={delay}><button onClick={onClick} className={"home2-press relative flex h-full w-full flex-col overflow-hidden p-4 text-left "+surface+" "+tone}>
 <div className="flex items-start justify-between"><LineArt name={art} accent={accent} className="-mt-1 -ml-1 size-12 text-[#162d53]" /><ArrowUpRight className="size-4 text-[#5d697e] " /></div>
 <h3 className="mt-2.5 text-[14px] leading-tight font-bold tracking-[-0.01em]">{title}</h3><p className="mt-0.5 text-[11.5px] text-[#3e4b62]">{body}</p></button></Tile>
}

function NavItem({icon:Icon,label,active,onClick}:{icon:LucideIcon;label:string;active?:boolean;onClick:()=>void}){
 return <button onClick={onClick} aria-current={active?'page':undefined} className={"flex min-w-14 flex-col items-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-semibold transition "+(active?"text-[#1c3d70]":"text-[#5d697e]")}><span className={"grid h-7 w-11 place-items-center rounded-full "+(active?"bg-[#e6edf8]":"")}><Icon className="size-[19px]" strokeWidth={active?2.2:1.8} /></span>{label}</button>
}