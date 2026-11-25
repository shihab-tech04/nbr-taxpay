import { useCallback, useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'
import type { Copy } from './i18n'

export type Home2Action = 'home' | 'original' | 'pay' | 'other' | 'gift' | 'travel' | 'login' | 'guide' | 'report' | 'help' | 'history' | 'certificates' | 'corrections' | 'again' | 'drafts' | 'status' | 'receipts' | 'security' | 'nbr'

export type ViewProps = {
  c: Copy
  onToggleLang: () => void
  onAction: (action: Home2Action) => void
  onSearch: (reference: string) => void
  signedIn: boolean
  sliderPaused: boolean
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

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid place-items-center bg-gradient-to-br from-[#f2a516] to-[#e0761b] shadow-[0_4px_12px_-4px_rgba(224,118,27,0.6)] ${lg ? 'size-10 rounded-[12px]' : 'size-9 rounded-[11px]'}`}
      >
        <div className={`grid place-items-center bg-white/95 ${lg ? 'size-[26px] rounded-[8px]' : 'size-6 rounded-[7px]'}`}>
          <span className={`home2-font-bn leading-none font-bold text-[#1c3d70] ${lg ? 'text-[15px]' : 'text-[13px]'}`}>৳</span>
        </div>
      </div>
      <div className="leading-none">
        <div className={`home2-font-bn font-bold tracking-tight text-[#0f1d34] ${lg ? 'text-[21px]' : 'text-[19px]'}`}>সহজকর</div>
        <div className={`home2-font-bn mt-0.5 font-medium text-[#5d697e] ${lg ? 'text-[10.5px]' : 'text-[9.5px]'}`}>আমার করেই গড়ব স্বদেশ</div>
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
        className={`flex items-center gap-2 rounded-2xl bg-white pr-1.5 pl-4 ring-1 transition focus-within:ring-2 focus-within:ring-[#7497cd]/60 shadow-[0_1px_2px_rgba(21,32,51,0.04)] ${lg ? 'h-14' : 'h-[52px]'} ${state.status === 'error' ? 'ring-[#e5484d]/60' : 'ring-[#dfe5ee]'}`}
      >
        <Search className="size-[18px] shrink-0 text-[#5d697e]" aria-hidden />
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
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#0f1d34] outline-none placeholder:text-[#9aa1b4]"
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
          className={`home2-press grid shrink-0 place-items-center rounded-xl bg-[#e6edf8] text-[#1c3d70] ring-1 ring-[#cad8ef] hover:bg-[#cad8ef] disabled:opacity-80 ${lg ? 'size-11' : 'size-10'}`}
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
