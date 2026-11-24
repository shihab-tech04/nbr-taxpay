import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
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
  Receipt,
  Repeat2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import hero from '../assets/hero.webp'
import { Logo, SearchPanel, Tile, promoSlides, slideCount, useCarousel, type ViewProps, type Home2Action } from '../shared'

const lift = 'transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(20,27,45,0.45)]'
const trustIcons = [ShieldCheck, Zap, Receipt]

export function DesktopView({ c, onToggleLang, onAction, onSearch, signedIn }: ViewProps) {
  const car = useCarousel(slideCount)
  const f = c.features
  const open = (action: Home2Action) => () => onAction(action)
  const links = [
    { action: 'status' as const, label: c.links.status },
    { action: 'receipts' as const, label: c.links.receipts },
    { action: 'security' as const, label: c.links.security },
    { action: 'nbr' as const, label: c.links.nbr, external: true },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f4f8]">
      {/* Header */}
      <header role="banner" className="sticky top-0 z-30 border-b border-[#e7e9ef]/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto grid h-16 w-full max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center px-8">
          <Logo />
          <nav aria-label="Primary" className="flex items-center gap-0.5 rounded-full bg-[#f3f4f8] p-1 ring-1 ring-[#e7e9ef]">
            <NavPill icon={House} label={c.nav.home} active onClick={open('home')} />
            <NavPill icon={CircleHelp} label={c.nav.guide} onClick={open('guide')} />
            <NavPill icon={ShieldAlert} label={c.nav.report} onClick={open('report')} />
          </nav>
          <div className="flex items-center gap-2 justify-self-end">
            <button
              onClick={onToggleLang}
              aria-label={c.langSwitchLabel}
              className="home2-press flex h-10 items-center gap-2 rounded-full border border-[#e7e9ef] bg-white px-3.5 text-[13px] font-medium text-[#141b2d] hover:bg-[#f3f4f8]"
            >
              <Globe className="size-4 text-[#2f55a4]" /> {c.langSwitch}
            </button>
            <button
              onClick={open('login')}
              className="home2-press flex h-10 items-center gap-1.5 rounded-full bg-[#2f55a4] pr-3.5 pl-4.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,85,164,0.8)] hover:bg-[#1f3c7a]"
            >
              {signedIn ? (c.langSwitch === 'English' ? 'ড্যাশবোর্ড' : 'Dashboard') : c.login} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <section aria-label={c.section.title} className="mx-auto w-full max-w-[1240px] flex-1 px-8 pt-5 pb-10">
        <section className="grid grid-cols-[minmax(0,1fr)_clamp(320px,30vw,372px)] gap-3">
          {/* Hero carousel */}
          <Tile>
            <div data-testid="home2-desktop-hero" className="relative h-full min-h-[340px] overflow-hidden rounded-[24px] bg-[#f8f0dc] ring-1 ring-[#efe3c4]">
              <div ref={car.ref} onScroll={car.onScroll} className="home2-no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto">
                <div className="relative min-h-[340px] w-full shrink-0 snap-center">
                  {/* Illustration sits beside the copy, never under it */}
                  <div className="absolute inset-y-0 right-0 left-[min(460px,65%)]">
                    <img src={hero} alt="" className="size-full object-cover object-[70%_60%]" />
                    <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#f8f0dc] to-transparent" />
                  </div>
                  <div data-testid="home2-hero-copy" className="relative flex min-h-[340px] h-full max-w-[500px] flex-col justify-center py-7 pr-6 pl-9">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[#6b5a1e] uppercase ring-1 ring-[#6b5a1e]/10">
                      <ShieldCheck className="size-3.5" /> {c.eyebrow}
                    </span>
                    <h1 className="mt-3.5 text-[36px] leading-[1.1] font-bold tracking-[-0.025em] text-[#45390e]">{c.heroTitle}</h1>
                    <p className="mt-3 text-[14.5px] leading-relaxed text-[#6b5f3a]">{c.heroBody}</p>
                    <div className="mt-6 flex flex-wrap gap-2.5">
                      <button
                        onClick={open('pay')} data-testid="home2-pay"
                        className="home2-press flex h-12 items-center gap-2 rounded-xl bg-[#2f55a4] px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_24px_-12px_rgba(47,85,164,0.85)] hover:bg-[#1f3c7a]"
                      >
                        <Wallet className="size-[18px]" /> {c.payTax}
                      </button>
                      <button
                        onClick={open('other')} data-testid="home2-other"
                        className="home2-press flex h-12 items-center gap-2 rounded-xl bg-white/80 px-6 text-[14.5px] font-semibold text-[#45390e] ring-1 ring-[#6b5a1e]/20 hover:bg-white"
                      >
                        <FileText className="size-[18px]" /> {c.otherTax}
                      </button>
                    </div>
                    <ul data-testid="home2-hero-trust" className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {c.trust.map((label, i) => {
                        const Icon = trustIcons[i]
                        return (
                          <li key={label} className="flex items-center gap-1.5 text-[12px] font-medium text-[#7a6c45]">
                            <Icon className="size-3.5 text-[#a08a4c]" /> {label}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
                {promoSlides.map((sl) => {
                  const s = c.slides[sl.key]
                  return (
                    <div key={sl.key} className={`relative flex min-h-[340px] w-full shrink-0 snap-center items-center overflow-hidden px-9 py-7 ${sl.tone}`}>
                      <sl.icon className="pointer-events-none absolute -right-8 -bottom-12 size-[300px] opacity-[0.08]" strokeWidth={1} aria-hidden />
                      <div className="relative max-w-[460px]">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${sl.chip}`}>{s.eyebrow}</span>
                        <h2 className="mt-3.5 text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{s.title}</h2>
                        <p className="mt-3 max-w-[400px] text-[14.5px] leading-relaxed opacity-75">{s.body}</p>
                        <button onClick={open(sl.key === 'cert' ? 'certificates' : 'again')} className={`home2-press mt-6 flex h-12 items-center gap-2 rounded-xl px-6 text-[14.5px] font-semibold ${sl.cta}`}>
                          {s.cta} <ArrowRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-full bg-white/85 p-1 shadow-[0_8px_24px_-12px_rgba(20,27,45,0.45)] ring-1 ring-black/5 backdrop-blur-md">
                <button onClick={car.prev} aria-label={c.carousel.prev} className="home2-press grid size-8 place-items-center rounded-full text-[#141b2d] hover:bg-[#f3f4f8]">
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex items-center gap-1.5 px-1">
                  {Array.from({ length: slideCount }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => car.goTo(i)}
                      aria-label={c.carousel.goTo(i + 1)}
                      aria-current={car.index === i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${car.index === i ? 'w-5 bg-[#2f55a4]' : 'w-1.5 bg-[#c8ccd8] hover:bg-[#a9afc0]'}`}
                    />
                  ))}
                </div>
                <button onClick={car.next} aria-label={c.carousel.next} className="home2-press grid size-8 place-items-center rounded-full text-[#141b2d] hover:bg-[#f3f4f8]">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </Tile>

          <div className="flex flex-col gap-3">
            {/* Search */}
            <Tile delay={80} className="rounded-[24px] bg-white p-5 ring-1 ring-[#e7e9ef]">
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef2fb] text-[#2f55a4]">
                  <Receipt className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] leading-tight font-semibold tracking-[-0.01em]">{c.find.title}</h2>
                  <p className="mt-1 text-[12.5px] leading-snug text-[#5f6880]">{c.find.body}</p>
                </div>
              </div>
              <SearchPanel c={c} onSearch={onSearch} />
            </Tile>

            {/* Guide */}
            <Tile delay={140} className="flex flex-1 flex-col">
              <div className="relative flex flex-1 flex-col justify-between gap-4 overflow-hidden rounded-[24px] bg-[#eef2fb] p-5 ring-1 ring-[#dde5f6]">
                <BookOpen className="pointer-events-none absolute -right-6 -bottom-8 size-32 text-[#2f55a4] opacity-[0.07]" strokeWidth={1.2} aria-hidden />
                <div className="relative flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#2f55a4] shadow-sm">
                    <CircleHelp className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] leading-tight font-semibold tracking-[-0.01em]">{c.help.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#5f6880]">{c.help.body}</p>
                  </div>
                </div>
                <div className="relative grid grid-cols-2 gap-2">
                  <button data-testid="home2-guide-action" onClick={open('guide')} className="home2-press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#2f55a4] px-2 whitespace-nowrap text-[13px] font-semibold text-white hover:bg-[#1f3c7a]">
                    {c.help.guide} <ArrowRight className="size-4" />
                  </button>
                  <button data-testid="home2-chat-action" onClick={open('help')} className="home2-press flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-2 whitespace-nowrap text-[13px] font-semibold text-[#141b2d] ring-1 ring-[#e7e9ef] hover:bg-white/70">
                    <MessageCircle className="size-4 text-[#2f55a4]" /> {c.help.chat}
                  </button>
                </div>
              </div>
            </Tile>
          </div>
        </section>

        {/* Bento */}
        <section className="mt-7" aria-labelledby="features-title">
          <Tile delay={200} className="mb-3 flex items-end justify-between gap-6 px-1">
            <div>
              <h2 id="features-title" className="text-[20px] leading-tight font-semibold tracking-[-0.015em]">
                {c.section.title}
              </h2>
              <p className="mt-0.5 text-[13.5px] text-[#5f6880]">{c.section.body}</p>
            </div>
            <button onClick={open('login')} className="group -mr-2 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-[#2f55a4] transition hover:bg-[#e6ebf7]">
              {signedIn ? (c.langSwitch === 'English' ? 'ড্যাশবোর্ড দেখুন' : 'Open dashboard') : c.section.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Tile>

          <div className="grid grid-cols-12 grid-rows-[repeat(2,minmax(140px,auto))_auto] gap-3">
            <Tile delay={240} className="col-span-6 row-span-2">
              <button
                onClick={open('pay')}
                className={`home2-press group relative flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-gradient-to-br from-[#2f55a4] to-[#1f3c7a] p-6 text-left text-white ${lift}`}
              >
                <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -top-6 -right-2 size-36 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-[#f2a516]/20 blur-3xl" />
                <div className="relative flex items-start justify-between">
                  <div className="grid size-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                    <Wallet className="size-6" />
                  </div>
                  <span className="grid size-10 place-items-center rounded-full bg-white text-[#2f55a4] transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-[18px]" />
                  </span>
                </div>
                <div className="relative mt-auto pt-4">
                  <h3 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{f.all.title}</h3>
                  <p className="mt-1 text-[14px] text-white/75">{f.all.body}</p>
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {f.all.chips.map((x) => (
                      <span key={x} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium ring-1 ring-white/15">
                        {x}
                      </span>
                    ))}
                  </div>
                  <ol className="mt-4 grid grid-cols-3 gap-2">
                    {f.all.steps.map((step, i) => (
                      <li key={step} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                        <span className="grid size-6 place-items-center rounded-full bg-[#f2a516] text-[11px] font-bold text-[#141b2d]">{i + 1}</span>
                        <span className="mt-2 block text-[13px] leading-tight font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </button>
            </Tile>

            <Tile delay={280} className="col-span-3 row-span-2">
              <button onClick={open('history')} className={`home2-press group flex h-full w-full flex-col rounded-[24px] bg-[#fdf3e3] p-5 text-left ring-1 ring-[#f3e1c0] ${lift}`}>
                <div className="flex items-start justify-between">
                  <div className="grid size-10 place-items-center rounded-xl bg-white text-[#c27a10] shadow-sm">
                    <History className="size-5" />
                  </div>
                  <ArrowUpRight className="size-[18px] text-[#cdb88f] transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#c27a10]" />
                </div>
                <h3 className="mt-3.5 text-[16px] leading-tight font-semibold tracking-[-0.01em]">{f.history.title}</h3>
                <p className="mt-1 text-[12.5px] leading-snug text-[#7a6a4c]">{f.history.body}</p>
                <div className="mt-auto space-y-1.5 pt-3.5">
                  {c.taxYears.map((y, i) => (
                    <div key={y} aria-hidden="true" className="flex items-center gap-2.5 rounded-xl bg-white/85 px-2.5 py-2" style={{ opacity: 1 - i * 0.2 }}>
                      <Receipt className="size-4 shrink-0 text-[#c27a10]" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#9a8a6a]">
                        {f.history.taxYear} <span className="font-semibold text-[#141b2d]">{y}</span>
                      </span>
                      <Download className="size-3.5 shrink-0 text-[#b8a07a]" aria-hidden />
                    </div>
                  ))}
                </div>
              </button>
            </Tile>

            <FeatureTile delay={320} className="col-span-3" icon={FileCheck2} title={f.certs.title} body={f.certs.body} onClick={open('certificates')} tone="bg-white ring-1 ring-[#e7e9ef]" iconTone="bg-[#e6f4f1] text-[#0f7a68]" />
            <FeatureTile delay={360} className="col-span-3" icon={FilePen} title={f.corrections.title} body={f.corrections.body} onClick={open('corrections')} tone="bg-white ring-1 ring-[#e7e9ef]" iconTone="bg-[#f1ecfb] text-[#6a45c2]" />
            <FeatureTile
              row
              delay={400}
              className="col-span-4"
              icon={Repeat2}
              title={f.again.title}
              body={f.again.body}
              onClick={open('again')}
              tone="bg-[#fdecef] ring-1 ring-[#f6d3da]"
              iconTone="bg-white text-[#c4364f] shadow-sm"
              bodyTone="text-[#8a5862]"
              arrowTone="text-[#dcaab4]"
            />
            <FeatureTile
              row
              delay={440}
              className="col-span-4"
              icon={Save}
              title={f.drafts.title}
              body={f.drafts.body}
              onClick={open('drafts')}
              tone="bg-[#141b2d] text-white"
              iconTone="bg-white/10 text-white"
              bodyTone="text-white/60"
              arrowTone="text-white/40"
            />
            <FeatureTile
              row
              delay={480}
              className="col-span-4"
              icon={ShieldCheck}
              title={f.secure.title}
              body={f.secure.body}
              onClick={open('security')}
              tone="bg-[#e9f2ea] text-[#17402a] ring-1 ring-[#d3e6d6]"
              iconTone="bg-white text-[#1d7a46] shadow-sm"
              bodyTone="text-[#4b6b56]"
              arrowTone="text-[#9cc0a6]"
            />
          </div>
        </section>
      </section>

      <footer role="contentinfo" className="border-t border-[#e7e9ef] bg-white">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-5">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="h-8 w-px bg-[#e7e9ef]" aria-hidden />
            <p className="max-w-[130px] text-[12px] leading-snug text-[#5f6880]">{c.footer.tagline}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-0.5">
            {links.map((l) => (
              <button key={l.label} onClick={open(l.action)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#3d465c] transition hover:bg-[#f3f4f8] hover:text-[#141b2d]">
                {l.label}
                {l.external && <ArrowUpRight className="size-3.5" />}
              </button>
            ))}
          </nav>
          <div className="text-[12px] text-[#5f6880]"><p>{c.footer.copyright}</p><a href="?action=landing" className="underline" onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onAction('original')}}}>{c.langSwitch === 'English' ? 'মূল পাতা' : 'Original Home'}</a></div>
        </div>
      </footer>

      <button
        onClick={open('help')}
        className="home2-press fixed right-6 bottom-6 z-30 flex h-12 items-center gap-2 rounded-full bg-[#2f55a4] pr-4.5 pl-3.5 text-[13.5px] font-semibold text-white shadow-[0_14px_28px_-12px_rgba(47,85,164,0.85)] ring-4 ring-white/70 hover:bg-[#1f3c7a]"
      >
        <MessageCircle className="size-[18px]" /> {c.nav.help}
      </button>
    </div>
  )
}

function NavPill({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition ${active ? 'bg-white text-[#2f55a4] shadow-[0_1px_3px_rgba(20,27,45,0.1)] ring-1 ring-[#e7e9ef]' : 'text-[#4a5368] hover:text-[#141b2d]'}`}
    >
      <Icon className="size-4" /> {label}
    </button>
  )
}

function FeatureTile({
  icon: Icon,
  title,
  body,
  onClick,
  className,
  tone,
  iconTone,
  bodyTone = 'text-[#5f6880]',
  arrowTone = 'text-[#b4bacb]',
  row = false,
  delay,
}: {
  icon: LucideIcon
  title: string
  body: string
  onClick: () => void
  className: string
  tone: string
  iconTone: string
  bodyTone?: string
  arrowTone?: string
  /** Horizontal layout for short, wide tiles. */
  row?: boolean
  delay: number
}) {
  const arrow = <ArrowUpRight className={`size-[18px] shrink-0 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${arrowTone}`} />
  const icon = (
    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTone}`}>
      <Icon className="size-5" />
    </div>
  )

  return (
    <Tile delay={delay} className={className}>
      <button onClick={onClick} className={`home2-press group flex h-full w-full rounded-[24px] p-5 text-left ${row ? 'items-start gap-3.5' : 'flex-col'} ${lift} ${tone}`}>
        {row ? (
          <>
            {icon}
            <div className="min-w-0 flex-1">
              <h3 className="text-[15.5px] leading-tight font-semibold tracking-[-0.01em]">{title}</h3>
              <p className={`mt-1 text-[12.5px] leading-snug ${bodyTone}`}>{body}</p>
            </div>
            {arrow}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between">
              {icon}
              {arrow}
            </div>
            <h3 className="mt-auto pt-3 text-[15.5px] leading-tight font-semibold tracking-[-0.01em]">{title}</h3>
            <p className={`mt-1 text-[12.5px] leading-snug ${bodyTone}`}>{body}</p>
          </>
        )}
      </button>
    </Tile>
  )
}
