import { ArrowRight } from 'lucide-react'
import { LineArt } from './lineArt'
import { Tile, type ViewProps } from './shared'

/** Home 2's two existing dedicated tax journeys; no intermediate chooser. */
export function OtherTaxCard({c,onAction,desktop=false}:Pick<ViewProps,'c'|'onAction'>&{desktop?:boolean}){
  const p=c.otherPayments
  return <Tile delay={140} className={desktop?'flex flex-1 flex-col':'home2-v2-type'}>
    <div data-testid="home2-other-payments" className={'relative flex flex-1 flex-col justify-between gap-4 overflow-hidden rounded-[20px] bg-white ring-1 ring-[#e2e5eb] '+(desktop?'p-6':'p-5')}>
      <LineArt name="guide" accent="#acd0dc" className={'absolute top-4 right-4 text-[#162d53] '+(desktop?'size-16':'size-14')} />
      <div className={'relative '+(desktop?'pr-20':'pr-16')}>
        <h3 className={(desktop?'text-[18px]':'text-[16px]')+' leading-tight font-bold tracking-[-0.015em]'}>{p.title}</h3>
        <p className={'mt-1.5 leading-snug text-[#3e4b62] '+(desktop?'text-[13px]':'text-[12.5px]')}>{p.body}</p>
      </div>
      <div className="relative grid grid-cols-2 gap-2">
        <button type="button" data-testid="home2-gift-action" onClick={()=>onAction('gift')} className="home2-press flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#edf3fc] px-2 py-2 text-center text-[13px] font-semibold leading-snug hover:bg-[#e0eaf9]">{p.gift}<ArrowRight className="size-4 shrink-0" aria-hidden="true"/></button>
        <button type="button" data-testid="home2-travel-action" onClick={()=>onAction('travel')} className="home2-press flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#edf3fc] px-2 py-2 text-center text-[13px] font-semibold leading-snug hover:bg-[#e0eaf9]">{p.travel}<ArrowRight className="size-4 shrink-0" aria-hidden="true"/></button>
      </div>
    </div>
  </Tile>
}
