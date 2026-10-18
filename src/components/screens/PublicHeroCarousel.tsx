import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, WalletCards } from 'lucide-react';
import type { BannerPaymentService } from '../../services/taxState';
import heroPaymentIllustration from '../../assets/taxpay-hero-payment-v3.webp';
import returnTaxIllustration from '../../assets/taxpay-hero-return-v3.webp';
import advanceTaxIllustration from '../../assets/taxpay-hero-advance-v3.webp';
import withholdingTaxIllustration from '../../assets/taxpay-hero-withholding-v3.webp';
import travelTaxIllustration from '../../assets/taxpay-hero-travel-v6.webp';

const AUTOPLAY_INTERVAL_MS = 8_000;
const SWIPE_THRESHOLD_PX = 45;
const SWIPE_DOMINANCE_RATIO = 1.2;

const slides = [
  {
    id: 'intro',
    serviceCode: undefined,
    headingEn: 'Understand tax payments. Stay in control.',
    headingBn: 'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।',
    descriptionEn: 'Choose the right tax service, check payment status and find receipts in one place.',
    descriptionBn: 'সঠিক করসেবা বেছে নিন, পেমেন্টের অবস্থা দেখুন ও রসিদ খুঁজুন এক জায়গায়।',
    actionEn: 'Pay Tax',
    actionBn: 'কর পরিশোধ',
    image: heroPaymentIllustration,
  },
  {
    id: 'return',
    serviceCode: 'TAX_WITH_RETURN',
    headingEn: 'Tax with Return',
    headingBn: 'রিটার্নের সঙ্গে কর',
    descriptionEn: 'Settle the income tax linked to your return through clear, guided steps.',
    descriptionBn: 'রিটার্নের সঙ্গে সংশ্লিষ্ট আয়কর সহজ ও স্পষ্ট ধাপে পরিশোধ করুন।',
    actionEn: 'Pay Tax with Return',
    actionBn: 'রিটার্নের সঙ্গে কর পরিশোধ',
    image: returnTaxIllustration,
  },
  {
    id: 'advance',
    serviceCode: 'ADVANCE_TAX',
    headingEn: 'Advance Income Tax',
    headingBn: 'অগ্রিম আয়কর',
    descriptionEn: 'Plan ahead by paying income tax early for your chosen assessment year.',
    descriptionBn: 'নির্বাচিত করবর্ষে আগাম আয়কর দিয়ে আপনার কর পরিকল্পনা এগিয়ে নিন।',
    actionEn: 'Pay Advance Income Tax',
    actionBn: 'অগ্রিম আয়কর পরিশোধ',
    image: advanceTaxIllustration,
  },
  {
    id: 'withholding',
    serviceCode: 'SOURCE_TAX_DEPOSIT',
    headingEn: 'Source Tax Deposit (TDS/TCS)',
    headingBn: 'উৎসে কর জমা (টিডিএস/টিসিএস)',
    descriptionEn: 'Deposit tax already deducted or collected at source using the right payment head.',
    descriptionBn: 'উৎসে কাটা বা সংগৃহীত কর সঠিক খাতে সহজে জমা দিন।',
    actionEn: 'Deposit Source Tax',
    actionBn: 'উৎসে কর জমা দিন',
    image: withholdingTaxIllustration,
  },
  {
    id: 'travel',
    serviceCode: 'TRAVEL_TAX',
    headingEn: 'Travel Tax',
    headingBn: 'ভ্রমণ কর',
    descriptionEn: 'Choose your journey, add passenger details and move through travel tax with confidence.',
    descriptionBn: 'ভ্রমণের ধরন ও যাত্রীর তথ্য দিয়ে ভ্রমণ করের ধাপগুলো সহজে এগিয়ে নিন।',
    actionEn: 'Pay Travel Tax',
    actionBn: 'ভ্রমণ কর পরিশোধ',
    image: travelTaxIllustration,
  },
] as const;

type PublicHeroCarouselProps = {
  language: 'en' | 'bn';
  onPayTax: (service?: BannerPaymentService) => void;
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
        aria-description={bn ? 'অন্য সেবা দেখতে ডানে বা বামে সোয়াইপ করুন অথবা তীরচিহ্ন কী ব্যবহার করুন।' : 'Swipe or use the left and right arrow keys to see other services.'}
        className="public-hero-carousel"
        data-active-slide={activeIndex}
        data-payment-service={slides[activeIndex].serviceCode}
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
                data-payment-service={slide.serviceCode}
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
                    <button className="citizen-public-primary public-guest-action" type="button" onClick={() => onPayTax(slide.serviceCode)}>
                      <WalletCards size={18} aria-hidden="true" />{bn ? slide.actionBn : slide.actionEn}
                    </button>
                    {index === 0 && (
                      <button className="citizen-public-secondary public-guest-action" type="button" onClick={onCheckReceipt}>
                        <Search size={18} aria-hidden="true" />{bn ? 'পেমেন্ট ও রসিদ যাচাই' : 'Check payment & receipt'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="public-information-hero__media public-hero-carousel__media--illustrated" aria-hidden="true">
                  <img
                    className={`public-information-hero__image${index === 0 ? '' : ' public-hero-carousel__service-image'}`}
                    src={slide.image}
                    alt=""
                    decoding="async"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
