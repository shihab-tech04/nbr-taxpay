import React, { useCallback, useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export type OfficeSourceSlide = { headline: string; text: string; image: string };

/** Port of Office Management LoginSlider/LoginSlide (recovered commit 8a952327).
 * The original 7-second autoplay, 600ms crossfade, dots and pause control are preserved.
 */
export function OfficeSourceLoginSlider({slides}: {slides: readonly OfficeSourceSlide[]}) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number|null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const goTo = useCallback((next: number) => {
    if (transitioning || next === current) return;
    setPrev(current);
    setCurrent(next);
    setTransitioning(true);
  }, [current, transitioning]);
  useEffect(()=>{
    if (!transitioning) return;
    const timeout = window.setTimeout(() => {setPrev(null);setTransitioning(false)},600);
    return () => window.clearTimeout(timeout);
  },[transitioning]);
  useEffect(()=>{
    if(paused || slides.length<2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id=window.setInterval(()=>goTo((current+1)%slides.length),7000);
    return ()=>window.clearInterval(id);
  },[paused,slides.length,current,goTo]);
  return <div className="login-slider">
    <div className="login-slide__stage" aria-live="off">
      {prev!==null && <div className="login-slide__layer login-slide__layer--out" aria-hidden="true"><OfficeSourceLoginSlide slide={slides[prev]}/></div>}
      <div className="login-slide__layer login-slide__layer--in" key={current}><OfficeSourceLoginSlide slide={slides[current]}/></div>
    </div>
    <div className="login-slide__controls">
      <div className="login-slide__dots" aria-label="Slideshow navigation">
        {slides.map((_,i)=><button type="button" key={i} className={'login-slide__dot '+(i===current?'login-slide__dot--active':'login-slide__dot--inactive')} aria-label={`Go to slide ${i+1}`} aria-current={i===current?'true':undefined} onClick={()=>goTo(i)}/>)}
      </div>
      <button type="button" className="login-slide__pause-btn" onClick={()=>setPaused(p=>!p)} aria-label={paused?'Play slideshow':'Pause slideshow'} aria-pressed={paused}>{paused?<Play size={12} aria-hidden="true"/>:<Pause size={12} aria-hidden="true"/>}</button>
    </div>
  </div>;
}
function OfficeSourceLoginSlide({slide}:{slide:OfficeSourceSlide}){
  return <><div className="login-slide__image"><img src={slide.image} alt="" loading="eager"/></div><div className="login-slide__content"><h2 className="login-slide__headline">{slide.headline}</h2><p className="login-slide__text">{slide.text}</p></div></>;
}
