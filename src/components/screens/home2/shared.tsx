import { useCallback, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, FileCheck2, Repeat2, Search, X } from 'lucide-react'
import type { Copy } from './i18n'

export type Home2Action = 'home' | 'original' | 'pay' | 'other' | 'login' | 'guide' | 'report' | 'help' | 'history' | 'certificates' | 'corrections' | 'again' | 'drafts' | 'status' | 'receipts' | 'security' | 'nbr'

export type ViewProps = {
  c: Copy
  onToggleLang: () => void
  onAction: (action: Home2Action) => void
  onSearch: (reference: string) => void
  signedIn: boolean
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** Promo slides that follow the main hero slide; copy lives in i18n under the same key. */
export const promoSlides = [
  {
    key: 'cert',
    icon: FileCheck2,
    tone: 'bg-[#1f3c7a] text-white',
    chip: 'bg-white/15 text-white',
    cta: 'bg-white text-[#141b2d] hover:bg-white/90',
  },
  {
    key: 'again',
    icon: Repeat2,
    tone: 'bg-[#e4efe6] text-[#17402a]',
    chip: 'bg-[#17402a]/10 text-[#17402a]',
    cta: 'bg-[#17402a] text-white hover:bg-[#0f2e1d]',
  },
] as const

export const slideCount = promoSlides.length + 1

export function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const onScroll = () => {
    const el = ref.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const target = (i + count) % count
    el.scrollTo({ left: target * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return { ref, index, onScroll, goTo, next: () => goTo(index + 1), prev: () => goTo(index - 1) }
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid place-items-center bg-gradient-to-br from-[#f2a516] to-[#e0761b] shadow-[0_4px_12px_-4px_rgba(224,118,27,0.6)] ${lg ? 'size-10 rounded-[12px]' : 'size-9 rounded-[11px]'}`}
      >
        <div className={`grid place-items-center bg-white/95 ${lg ? 'size-[26px] rounded-[8px]' : 'size-6 rounded-[7px]'}`}>
          <span className={`home2-font-bn leading-none font-bold text-[#1f3c7a] ${lg ? 'text-[15px]' : 'text-[13px]'}`}>৳</span>
        </div>
      </div>
      <div className="leading-none">
        <div className={`home2-font-bn font-bold tracking-tight text-[#141b2d] ${lg ? 'text-[21px]' : 'text-[19px]'}`}>সহজকর</div>
        <div className={`home2-font-bn mt-0.5 font-medium text-[#5f6880] ${lg ? 'text-[10.5px]' : 'text-[9.5px]'}`}>আমার করেই গড়ব স্বদেশ</div>
      </div>
    </div>
  )
}

/** Grid/bento cell with a staggered entrance. */
export function Tile({ className = '', children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <div className={`home2-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

type SearchState = { status: 'idle' } | { status: 'error' }

export function SearchPanel({ c, size = 'md', onSearch }: { c: Copy; size?: 'md' | 'lg'; onSearch: (reference: string) => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const lg = size === 'lg'


  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ref = query.trim()
    if (!ref) {
      setState({ status: 'error' })
      return
    }
    onSearch(ref)
  }

  const reset = () => {
    setState({ status: 'idle' })
  }

  return (
    <form onSubmit={submit} noValidate role="search">
      <label htmlFor={id} className="sr-only">
        {c.find.title}
      </label>
      <div
        className={`flex items-center gap-2 rounded-2xl bg-[#f3f4f8] pr-1.5 pl-4 ring-1 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2f55a4]/40 ${lg ? 'h-14' : 'h-[52px]'} ${state.status === 'error' ? 'ring-[#e5484d]/60' : 'ring-[#e7e9ef]'}`}
      >
        <Search className="size-[18px] shrink-0 text-[#5f6880]" aria-hidden />
        <input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (state.status !== 'idle') reset()
          }}
          placeholder={c.find.placeholder}
          aria-invalid={state.status === 'error'}
          aria-describedby={state.status === 'error' ? `${id}-error` : undefined}
          autoComplete="off"
          spellCheck={false}
          type="search"
          maxLength={120}
          data-testid="home2-reference"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#141b2d] outline-none placeholder:text-[#9aa1b4]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              reset()
            }}
            className="grid size-7 shrink-0 place-items-center rounded-full text-[#5f6880] transition hover:bg-[#e7e9ef]/60 hover:text-[#141b2d]"
            aria-label={c.find.clear}
          >
            <X className="size-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!query.trim()}
          className={`home2-press grid shrink-0 place-items-center rounded-xl bg-[#2f55a4] text-white hover:bg-[#1f3c7a] disabled:opacity-80 ${lg ? 'size-11' : 'size-10'}`}
          aria-label={c.find.search}
        >
          <ArrowRight className="size-[18px]" />
        </button>
      </div>
      <div aria-live="polite">
        {state.status === 'error' && (
          <p id={`${id}-error`} className="mt-2 pl-1 text-[12px] font-medium text-[#d0353b]">
            {c.langSwitch === 'English' ? 'রেফারেন্স লিখুন।' : 'Enter a payment reference.'}
          </p>
        )}

      </div>
    </form>
  )
}
