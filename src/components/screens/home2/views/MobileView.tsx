import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronRight,
  CircleHelp,
  Download,
  FileCheck2,
  FilePen,
  FileText,
  Globe,
  History,
  House,
  MessageCircle,
  Plus,
  Receipt,
  Repeat2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import hero from '../assets/hero.webp'
import { Logo, SearchPanel, Tile, promoSlides, slideCount, useCarousel, type ViewProps, type Home2Action } from '../shared'

export function MobileView({ c, onToggleLang, onAction, onSearch, signedIn }: ViewProps) {
  const car = useCarousel(slideCount)
  const f = c.features
  const open = (action: Home2Action) => () => onAction(action)

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f4f6f9] pb-28 shadow-[0_0_60px_-20px_rgba(20,27,45,0.25)]">
      {/* Header */}
      <header role="banner" className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e7e9ef]/70 bg-[#f3f4f8]/85 px-4 py-2.5 backdrop-blur-xl">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLang}
            aria-label={c.langSwitchLabel}
            className="home2-press flex h-9 items-center gap-1.5 rounded-full border border-[#e7e9ef] bg-white px-3 text-[12.5px] font-medium text-[#141b2d]"
          >
            <Globe className="size-[15px] text-[#2f55a4]" />
            {c.langSwitch}
          </button>
          <button
            onClick={open('login')}
            className="home2-press flex h-9 items-center gap-1 rounded-full bg-[#2f55a4] pr-2.5 pl-3.5 text-[12.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(47,85,164,0.7)]"
          >
            {signedIn ? (c.langSwitch === 'English' ? 'ড্যাশবোর্ড' : 'Dashboard') : c.login}
            <ArrowRight className="size-[15px]" />
          </button>
        </div>
      </header>

      <section aria-label={c.section.title} className="space-y-3 px-4 pt-3">
        {/* Hero carousel */}
        <Tile>
          <div ref={car.ref} onScroll={car.onScroll} className="home2-no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[26px]">
            <div className="relative h-[392px] w-full shrink-0 snap-center overflow-hidden rounded-[24px] bg-gradient-to-b from-[#e6ecfa] to-[#cad7f2]">
              <img src={hero} alt="" className="absolute inset-x-0 bottom-0 h-[74%] w-full object-cover object-[50%_80%]" />
              <div className="absolute inset-x-0 top-0 h-[56%] bg-gradient-to-b from-[#e6ecfa] via-[#e6ecfa]/95 to-transparent" />
              <div className="relative px-5 pt-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#6b5a1e] uppercase ring-1 ring-[#6b5a1e]/10">
                  <ShieldCheck className="size-3.5" /> {c.eyebrow}
                </span>
                <h1 className="mt-2.5 text-[26px] leading-[1.12] font-bold tracking-[-0.02em] text-[#4a3d10]">{c.heroTitle}</h1>
                <p className="mt-2 max-w-[330px] text-[13px] leading-relaxed text-[#6b5f3a]">{c.heroBody}</p>
              </div>
              <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1.5 rounded-[18px] bg-white/75 p-1.5 shadow-[0_10px_30px_-12px_rgba(74,61,16,0.45)] backdrop-blur-md">
                <button onClick={open('pay')} data-testid="home2-pay" className="home2-press flex h-11 items-center justify-center gap-2 rounded-[13px] bg-[#2f55a4] text-[14px] font-semibold text-white">
                  <Wallet className="size-[18px]" /> {c.payTax}
                </button>
                <button onClick={open('other')} data-testid="home2-other" className="home2-press flex h-11 items-center justify-center gap-2 rounded-[13px] bg-white text-[14px] font-semibold text-[#4a3d10] ring-1 ring-[#6b5a1e]/15">
                  <FileText className="size-[18px]" /> {c.otherTax}
                </button>
              </div>
            </div>
            {promoSlides.map((sl) => {
              const s = c.slides[sl.key]
              return (
                <div key={sl.key} className={`relative flex h-[392px] w-full shrink-0 snap-center flex-col justify-between overflow-hidden rounded-[24px] p-5 ${sl.tone}`}>
                  <sl.icon className="pointer-events-none absolute -right-8 -bottom-8 size-56 opacity-[0.09]" strokeWidth={1.2} aria-hidden />
                  <div className="relative">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${sl.chip}`}>{s.eyebrow}</span>
                    <h2 className="mt-3 text-[27px] leading-[1.12] font-bold tracking-[-0.02em]">{s.title}</h2>
                    <p className="mt-2.5 max-w-[300px] text-[13.5px] leading-relaxed opacity-75">{s.body}</p>
                  </div>
                  <button onClick={open(sl.key === 'cert' ? 'certificates' : 'again')} className={`home2-press relative flex h-11 w-fit items-center gap-2 rounded-full px-5 text-[14px] font-semibold shadow-sm ${sl.cta}`}>
                    {s.cta} <ArrowRight className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {Array.from({ length: slideCount }, (_, i) => (
              <button
                key={i}
                onClick={() => car.goTo(i)}
                aria-label={c.carousel.goTo(i + 1)}
                aria-current={car.index === i}
                className={`h-1.5 rounded-full transition-all duration-300 ${car.index === i ? 'w-6 bg-[#2f55a4]' : 'w-1.5 bg-[#c8ccd8]'}`}
              />
            ))}
          </div>
        </Tile>

        {/* Search */}
        <Tile delay={80} className="rounded-[24px] bg-[#e8edf4] p-4 ring-1 ring-[#e7e9ef]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] leading-tight font-semibold tracking-[-0.01em]">{c.find.title}</h2>
              <p className="mt-1 text-[12px] leading-snug text-[#5f6880]">{c.find.body}</p>
            </div>
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef2fb] text-[#2f55a4]">
              <Receipt className="size-[18px]" />
            </div>
          </div>
          <SearchPanel c={c} onSearch={onSearch} />
        </Tile>

        {/* Bento */}
        <Tile delay={140} className="px-1 pt-1.5">
          <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.015em]">{c.section.title}</h2>
          <p className="mt-0.5 text-[12px] text-[#5f6880]">{c.section.body}</p>
        </Tile>

        <div className="grid grid-cols-2 gap-3">
          <Tile delay={180} className="col-span-2">
            <button onClick={open('pay')} className="home2-press relative block w-full overflow-hidden rounded-[24px] bg-[#dcebe9] p-4 text-left text-[#152033]">
              <div className="pointer-events-none absolute -top-16 -right-14 size-52 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -right-4 -bottom-20 size-40 rounded-full bg-[#f2a516]/25 blur-2xl" />
              <div className="relative flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Wallet className="size-5" />
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-white text-[#2f55a4]">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <h3 className="relative mt-5 text-[19px] leading-tight font-semibold tracking-[-0.01em]">{f.all.title}</h3>
              <p className="relative mt-1 text-[12.5px] text-[#4b5567]">{f.all.body}</p>
              <div className="relative mt-3 flex flex-wrap gap-1.5">
                {f.all.chips.map((x) => (
                  <span key={x} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ring-white/15">
                    {x}
                  </span>
                ))}
              </div>
            </button>
          </Tile>

          <Tile delay={220} className="row-span-2">
            <button onClick={open('history')} className="home2-press flex h-full w-full flex-col rounded-[24px] bg-[#f0e8d6] p-4 text-left ring-1 ring-[#f3e1c0]">
              <div className="grid size-9 place-items-center rounded-xl bg-white text-[#c27a10] shadow-sm">
                <History className="size-[18px]" />
              </div>
              <h3 className="mt-3 text-[14.5px] leading-tight font-semibold">{f.history.title}</h3>
              <p className="mt-1 text-[12px] leading-snug text-[#7a6a4c]">{f.history.body}</p>
              <div className="mt-auto space-y-1.5 pt-3">
                {c.taxYears.map((y, i) => (
                  <div key={y} aria-hidden="true" className="flex items-center justify-between rounded-lg bg-white/85 px-2.5 py-1.5" style={{ opacity: 1 - i * 0.22 }}>
                    <span className="text-[11.5px] font-semibold text-[#141b2d]">{y}</span>
                    <Download className="size-3.5 text-[#c27a10]" aria-hidden />
                  </div>
                ))}
              </div>
            </button>
          </Tile>

          <SmallTile delay={260} icon={FileCheck2} title={f.certs.title} body={f.certs.short} onClick={open('certificates')} tone="bg-[#e5e2f0] ring-1 ring-[#e7e9ef]" iconTone="bg-[#e6f4f1] text-[#0f7a68]" />
          <SmallTile delay={300} icon={FilePen} title={f.corrections.title} body={f.corrections.short} onClick={open('corrections')} tone="bg-[#f1e0d8] ring-1 ring-[#e7e9ef]" iconTone="bg-[#f1ecfb] text-[#6a45c2]" />
          <SmallTile delay={340} icon={Repeat2} title={f.again.title} body={f.again.short} onClick={open('again')} tone="bg-[#e6e9d6] text-[#141b2d] ring-1 ring-[#d6dcc0]" iconTone="bg-white text-[#626b3b] shadow-sm" bodyTone="text-[#535c3b]" />
          <SmallTile delay={380} icon={Save} title={f.drafts.title} body={f.drafts.short} onClick={open('drafts')} tone="bg-[#f0dfe3] text-[#141b2d] ring-1 ring-[#e6cdd4]" iconTone="bg-white text-[#98566b] shadow-sm" bodyTone="text-[#704e5b]" />

          <Tile delay={420} className="col-span-2">
            <div className="flex items-center gap-3 rounded-[24px] bg-[#e8edf4] px-4 py-3.5 ring-1 ring-[#d3e6d6]">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#1d7a46] shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[#17402a]">{f.secure.title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-[#4b6b56]">{f.secure.body}</p>
              </div>
            </div>
          </Tile>
        </div>

        {/* Quick links */}
        <Tile delay={460} className="overflow-hidden rounded-[24px] bg-white ring-1 ring-[#e7e9ef]">
          {[
            { action: 'status' as const, label: c.links.status, icon: CalendarCheck },
            { action: 'receipts' as const, label: c.links.receipts, icon: FilePen },
            { action: 'security' as const, label: c.links.security, icon: ShieldCheck },
            { action: 'nbr' as const, label: c.links.nbr, icon: ArrowUpRight, external: true },
          ].map((l, i) => (
            <button key={l.label} onClick={open(l.action)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-[#f3f4f8] ${i ? 'border-t border-[#e7e9ef]' : ''}`}>
              <l.icon className="size-[18px] text-[#5f6880]" />
              <span className="flex-1 text-[13.5px] font-medium">{l.label}</span>
              {l.external ? <ArrowUpRight className="size-4 text-[#a0a6b8]" /> : <ChevronRight className="size-4 text-[#a0a6b8]" />}
            </button>
          ))}
        </Tile>

        <footer role="contentinfo" className="flex flex-col items-center gap-2 pt-4 pb-1 text-center">
          <Logo />
          <p className="text-[11.5px] text-[#5f6880]">
            {c.footer.tagline} · {c.footer.copyright}
          </p>
          <a href="?action=landing" className="text-[11.5px] text-[#5f6880] underline" onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onAction('original')}}}>{c.langSwitch === 'English' ? 'মূল পাতা' : 'Original Home'}</a>
        </footer>
      </section>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="relative flex h-[66px] items-center justify-between rounded-[24px] border border-white/60 bg-white/90 px-2 shadow-[0_12px_40px_-12px_rgba(20,27,45,0.35)] backdrop-blur-xl">
          <NavItem icon={House} label={c.nav.home} active onClick={open('home')} />
          <NavItem icon={CircleHelp} label={c.nav.guideShort} onClick={open('guide')} />
          <div className="w-16" />
          <NavItem icon={ShieldAlert} label={c.nav.report} onClick={open('report')} />
          <NavItem icon={MessageCircle} label={c.nav.help} onClick={open('help')} />
          <button
            onClick={open('pay')}
            aria-label={c.payTax}
            className="home2-press absolute -top-5 left-1/2 grid size-[60px] -translate-x-1/2 place-items-center rounded-[20px] bg-[#2f55a4] text-white shadow-[0_12px_24px_-8px_rgba(47,85,164,0.8)] ring-4 ring-[#f3f4f8]"
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </button>
        </div>
      </nav>
    </div>
  )
}

function SmallTile({
  icon: Icon,
  title,
  body,
  onClick,
  tone,
  iconTone,
  bodyTone = 'text-[#5f6880]',
  delay,
}: {
  icon: LucideIcon
  title: string
  body: string
  onClick: () => void
  tone: string
  iconTone: string
  bodyTone?: string
  delay: number
}) {
  return (
    <Tile delay={delay}>
      <button onClick={onClick} className={`home2-press flex h-full w-full flex-col rounded-[24px] p-4 text-left ${tone}`}>
        <div className={`grid size-9 place-items-center rounded-xl ${iconTone}`}>
          <Icon className="size-[18px]" />
        </div>
        <h3 className="mt-4 text-[14px] leading-tight font-semibold">{title}</h3>
        <p className={`mt-0.5 text-[12px] ${bodyTone}`}>{body}</p>
      </button>
    </Tile>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-14 flex-col items-center gap-1 py-1 text-[10.5px] font-medium transition ${active ? 'text-[#2f55a4]' : 'text-[#8a91a5]'}`}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.9} />
      {label}
    </button>
  )
}
