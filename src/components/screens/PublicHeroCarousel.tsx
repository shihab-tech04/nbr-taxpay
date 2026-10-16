import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Search, WalletCards } from 'lucide-react';
import heroPaymentIllustration from '../../assets/taxpay-hero-payment.webp';

const AUTOPLAY_INTERVAL_MS = 4_500;
const SWIPE_THRESHOLD_PX = 45;
const SWIPE_DOMINANCE_RATIO = 1.2;

const slides = [
  {
    id: 'intro',
    headingEn: 'Understand tax payments. Stay in control.',
    headingBn: 'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।',
    descriptionEn: 'Explore payment guidance. Manage your transactions after login.',
    descriptionBn: 'কর পরিশোধের তথ্য জানুন। লগইনের পর লেনদেন পরিচালনা করুন।',
  },
  {
    id: 'return',
    headingEn: 'Pay tax with your return.',
    headingBn: 'রিটার্নের সঙ্গে কর পরিশোধ করুন।',
    descriptionEn: 'Pay income tax associated with your income tax return.',
    descriptionBn: 'আয়কর রিটার্নের সঙ্গে সংশ্লিষ্ট কর পরিশোধ করুন।',
  },
  {
    id: 'advance',
    headingEn: 'Plan ahead with advance tax.',
    headingBn: 'অগ্রিম আয়কর পরিশোধ করুন।',
    descriptionEn: 'Make an advance income tax payment for your assessment year.',
    descriptionBn: 'আপনার করবর্ষ অনুযায়ী অগ্রিম আয়কর পরিশোধ করুন।',
  },
  {
    id: 'withholding',
    headingEn: 'Deposit tax at source.',
    headingBn: 'উৎসে কর্তিত কর জমা দিন।',
    descriptionEn: 'Deposit tax deducted or collected at source (TDS/TCS).',
    descriptionBn: 'উৎসে কর্তন বা সংগ্রহ করা কর (টিডিএস/টিসিএস) জমা দিন।',
  },
  {
    id: 'travel',
    headingEn: 'Pay travel tax with ease.',
    headingBn: 'সহজে ভ্রমণ কর পরিশোধ করুন।',
    descriptionEn: 'Prepare a travel tax payment for your journey.',
    descriptionBn: 'আপনার ভ্রমণের জন্য ভ্রমণ কর পরিশোধের প্রস্তুতি নিন।',
  },
] as const;

type PublicHeroCarouselProps = {
  language: 'en' | 'bn';
  onPayTax: () => void;
  onCheckReceipt: () => void;
  paused?: boolean;
};

export const PublicHeroCarousel: React.FC<PublicHeroCarouselProps> = ({
  language,
  onPayTax,
  onCheckReceipt,
  paused = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const bn = language === 'bn';

  const goNext = useCallback(() => setActiveIndex(index => (index + 1) % slides.length), []);
  const goPrevious = useCallback(() => setActiveIndex(index => (index - 1 + slides.length) % slides.length), []);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    setPrefersReducedMotion(motionPreference.matches);
    motionPreference.addEventListener('change', onMotionChange);
    return () => motionPreference.removeEventListener('change', onMotionChange);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setIsDocumentVisible(document.visibilityState === 'visible');
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (paused || prefersReducedMotion || isHovered || hasFocus || isSwiping || !isDocumentVisible) return;
    const timer = window.setTimeout(goNext, AUTOPLAY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, goNext, hasFocus, isDocumentVisible, isHovered, isSwiping, paused, prefersReducedMotion]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target !== carouselRef.current && (target.closest('button, a, input, textarea, select, [role="button"]') || target.isContentEditable)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    }
  };

  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) setIsHovered(true);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    if (start) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE_RATIO) {
        if (dx < 0) goNext();
        else goPrevious();
      }
    }
    touchStartRef.current = null;
    setIsSwiping(false);
  };

  const cancelTouch = () => {
    touchStartRef.current = null;
    setIsSwiping(false);
  };

  return (
    <div
      ref={containerRef}
      className="public-hero-carousel-shell"
      onPointerEnter={onPointerEnter}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setIsHovered(false); }}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={event => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setHasFocus(false);
      }}
    >
      <section
        ref={carouselRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={bn ? 'কর পরিশোধের সেবা ব্যানার' : 'Tax payment service banners'}
        className="public-hero-carousel"
        data-active-slide={activeIndex}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelTouch}
      >
        <div className="public-hero-carousel__track" aria-live="off">
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            const heading = bn ? slide.headingBn : slide.headingEn;
            return (
              <article
                key={slide.id}
                className="citizen-public-hero public-information-hero public-hero-carousel__slide"
                data-banner-service={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={bn ? `স্লাইড ${index + 1} / ${slides.length}` : `Slide ${index + 1} of ${slides.length}`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                <div className="citizen-public-hero__copy">
                  {index === 0 ? <h1 id="public-home-title">{heading}</h1> : <h2>{heading}</h2>}
                  <p>{bn ? slide.descriptionBn : slide.descriptionEn}</p>
                  <div className="citizen-public-hero__actions public-guest-actions">
                    <button className="citizen-public-primary public-guest-action" type="button" onClick={onPayTax}>
                      <WalletCards size={18} aria-hidden="true" />{bn ? 'কর পরিশোধ' : 'Pay Tax'}
                    </button>
                    {index === 0 && (
                      <button className="citizen-public-secondary public-guest-action" type="button" onClick={onCheckReceipt}>
                        <Search size={18} aria-hidden="true" />{bn ? 'পেমেন্ট ও রসিদ যাচাই' : 'Check payment & receipt'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="public-information-hero__media" aria-hidden="true">
                  {index === 0 ? (
                    <img className="public-information-hero__image" src={heroPaymentIllustration} alt="" decoding="async" />
                  ) : (
                    <div className="public-hero-carousel__image-placeholder"><ImageIcon size={54} strokeWidth={1.25} /></div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--previous" onClick={goPrevious} aria-label={bn ? 'আগের ব্যানার' : 'Previous banner'}>
        <ChevronLeft size={21} aria-hidden="true" />
      </button>
      <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--next" onClick={goNext} aria-label={bn ? 'পরের ব্যানার' : 'Next banner'}>
        <ChevronRight size={21} aria-hidden="true" />
      </button>
    </div>
  );
};
