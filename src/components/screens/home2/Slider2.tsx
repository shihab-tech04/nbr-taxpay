import { PublicHeroCarousel } from '../PublicHeroCarousel';
import type { Home2Action } from './shared';
import './slider2.css';

/** A Home 2-only presentation of the existing published CMS carousel.
 * Do not create a second CMS, subscription, storage client or publish path. */
export function Slider2({language,onAction,paused=false}: {
  language:'en'|'bn'; onAction:(action:Home2Action)=>void; paused?:boolean;
}) {
  return <PublicHeroCarousel variant="home2" language={language}
    onPayTax={()=>onAction('pay')} onOtherTax={()=>onAction('other')} paused={paused}/>;
}
