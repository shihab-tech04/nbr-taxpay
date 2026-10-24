import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, WalletCards } from 'lucide-react';
import type { BannerPaymentService } from '../../services/taxState';
import heroPaymentIllustration from '../../assets/taxpay-hero-concept-intro.jpg';
import returnTaxIllustration from '../../assets/taxpay-hero-concept-return.jpg';
import advanceTaxIllustration from '../../assets/taxpay-hero-concept-advance.jpg';
import withholdingTaxIllustration from '../../assets/taxpay-hero-concept-withholding.jpg';
import travelTaxIllustration from '../../assets/taxpay-hero-concept-travel.jpg';
import { supabase } from '../../services/supabaseClient';

const AUTOPLAY_INTERVAL_MS = 8_000;
const SWIPE_THRESHOLD_PX = 45;
const SWIPE_DOMINANCE_RATIO = 1.2;

const defaultSlides = [
  {
    id: 'intro',
    serviceCode: undefined,
    headingEn: 'Your tax payments, made simpler',
    headingBn: 'আপনার কর পরিশোধ, আরও সহজে',
    mobileHeadingEn: 'Pay tax, step by step',
    mobileHeadingBn: 'কর পরিশোধ সহজ করুন',
    descriptionEn: 'Not sure which tax payment service you need? Choose what you want to pay, follow the steps and keep your payment details handy.',
    descriptionBn: 'কোন কর পরিশোধ করবেন বুঝতে পারছেন না? প্রয়োজনীয় সেবাটি বেছে নিন, ধাপে ধাপে পেমেন্ট করুন এবং পরিশোধের তথ্য সংরক্ষণ করুন।',
    mobileDescriptionEn: 'Choose a service and keep records.',
    mobileDescriptionBn: 'সেবা বেছে নিন, তথ্য সংরক্ষণ করুন।',
    actionEn: 'Pay Tax',
    actionBn: 'কর পরিশোধ',
    image: heroPaymentIllustration,
  },
  {
    id: 'return',
    serviceCode: 'TAX_WITH_RETURN',
    headingEn: 'Pay tax with your return',
    headingBn: 'রিটার্নের কর এখানেই দিন',
    mobileHeadingEn: 'Tax with Return',
    mobileHeadingBn: 'রিটার্নের সঙ্গে কর',
    descriptionEn: 'Need to pay tax with your income tax return? Make that payment here and keep its details for your records.',
    descriptionBn: 'আয়কর রিটার্নের সঙ্গে কর পরিশোধ করতে হবে? এখান থেকে পেমেন্ট করুন এবং রসিদের তথ্য সংরক্ষণ করুন।',
    mobileDescriptionEn: 'Pay tax due with your return.',
    mobileDescriptionBn: 'রিটার্নের কর পরিশোধ করুন।',
    actionEn: 'Pay Tax with Return',
    actionBn: 'রিটার্নের সঙ্গে কর পরিশোধ',
    image: returnTaxIllustration,
  },
  {
    id: 'advance',
    serviceCode: 'ADVANCE_TAX',
    headingEn: 'Pay income tax in advance',
    headingBn: 'আগাম আয়কর পরিশোধ করুন',
    mobileHeadingEn: 'Pay tax in advance',
    mobileHeadingBn: 'অগ্রিম আয়কর',
    descriptionEn: 'Making an advance income tax payment? Choose the relevant assessment year and enter your payment details.',
    descriptionBn: 'অগ্রিম আয়কর পরিশোধ করছেন? প্রযোজ্য করবর্ষ নির্বাচন করে প্রয়োজনীয় পেমেন্টের তথ্য দিন।',
    mobileDescriptionEn: 'Pay for your chosen tax year.',
    mobileDescriptionBn: 'নির্বাচিত করবর্ষের কর দিন।',
    actionEn: 'Pay Advance Income Tax',
    actionBn: 'অগ্রিম আয়কর পরিশোধ',
    image: advanceTaxIllustration,
  },
  {
    id: 'withholding',
    serviceCode: 'SOURCE_TAX_DEPOSIT',
    headingEn: 'Deducted tax? Deposit it here',
    headingBn: 'কর্তন বা আদায় করা কর জমা দিন',
    mobileHeadingEn: 'Deposit source tax',
    mobileHeadingBn: 'উৎসে কর জমা',
    descriptionEn: 'Deducted income tax from a payment, or collected it at source? Deposit that amount here and keep your payment reference.',
    descriptionBn: 'কোনো পেমেন্ট থেকে আয়কর কেটেছেন বা উৎসে কর আদায় করেছেন? সেই টাকা এখান থেকে জমা দিন এবং পেমেন্টের রেফারেন্স রাখুন।',
    mobileDescriptionEn: 'Deposit tax deducted or collected.',
    mobileDescriptionBn: 'কাটা বা আদায় করা কর জমা দিন।',
    actionEn: 'Deposit Source Tax',
    actionBn: 'উৎসে কর জমা দিন',
    image: withholdingTaxIllustration,
  },
  {
    id: 'travel',
    serviceCode: 'TRAVEL_TAX',
    headingEn: 'Travel tax for your journey',
    headingBn: 'যাত্রার আগে ভ্রমণ কর পরিশোধ',
    mobileHeadingEn: 'Pay travel tax',
    mobileHeadingBn: 'ভ্রমণ কর',
    descriptionEn: 'Planning to travel abroad? Add your journey and passenger details to pay any applicable travel tax.',
    descriptionBn: 'বিদেশ ভ্রমণের প্রস্তুতি নিচ্ছেন? ভ্রমণ ও যাত্রীর তথ্য দিয়ে প্রযোজ্য ভ্রমণ কর পরিশোধ করুন।',
    mobileDescriptionEn: 'Enter journey details to pay tax.',
    mobileDescriptionBn: 'ভ্রমণের তথ্য দিয়ে কর দিন।',
    actionEn: 'Pay Travel Tax',
    actionBn: 'ভ্রমণ কর পরিশোধ',
    image: travelTaxIllustration,
  },
] as const;

type BannerSlide = {
  id: string; serviceCode?: BannerPaymentService; headingEn: string; headingBn: string;
  mobileHeadingEn: string; mobileHeadingBn: string; descriptionEn: string; descriptionBn: string;
  mobileDescriptionEn: string; mobileDescriptionBn: string; actionEn: string; actionBn: string;
  image: string; mobileImage?: string;
};

const fallbackSlides: BannerSlide[] = defaultSlides.map(slide => ({ ...slide }));

function publicBannerImage(path: string | null, fallback: string): string {
  if (!path || !supabase) return fallback;
  return supabase.storage.from('taxpay-banners').getPublicUrl(path).data.publicUrl;
}

async function fetchPublishedBanners(): Promise<BannerSlide[]> {
  if (!supabase) return fallbackSlides;
  const { data, error } = await supabase.from('taxpay_site_banners').select('*')
    .eq('published', true).order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(row => {
    // Banner IDs identify editable records, while service_code identifies the
    // selected hero category. A category change must update the default image
    // even when the record keeps its original ID. Explicit uploads still win.
    const categoryImage = fallbackSlides.find(slide => (slide.serviceCode || null) === (row.service_code || null))?.image || heroPaymentIllustration;
    return {
      id: row.id, serviceCode: row.service_code || undefined,
      headingEn: row.heading_en, headingBn: row.heading_bn,
      mobileHeadingEn: row.mobile_heading_en, mobileHeadingBn: row.mobile_heading_bn,
      descriptionEn: row.description_en, descriptionBn: row.description_bn,
      mobileDescriptionEn: row.mobile_description_en, mobileDescriptionBn: row.mobile_description_bn,
      actionEn: row.action_en, actionBn: row.action_bn,
      image: publicBannerImage(row.desktop_image_path, categoryImage),
      mobileImage: row.mobile_image_path ? publicBannerImage(row.mobile_image_path, categoryImage) : undefined,
    };
  });
}

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
  const [slides, setSlides] = useState<BannerSlide[]>(fallbackSlides);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLElement>(null);
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const bn = language === 'bn';

  const goNext = useCallback(() => setActiveIndex(index => (index + 1) % Math.max(slides.length, 1)), [slides.length]);
  const goPrevious = useCallback(() => setActiveIndex(index => (index - 1 + slides.length) % Math.max(slides.length, 1)), [slides.length]);

  useEffect(() => {
    let active = true;
    const refresh = () => { void fetchPublishedBanners().then(next => {
      if (!active) return;
      setSlides(next);
      setActiveIndex(index => Math.min(index, Math.max(0, next.length - 1)));
    }).catch(() => { /* Preserve the verified bundled banners during a backend outage. */ }); };
    refresh();
    const channel = supabase?.channel('published-taxpay-banners')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taxpay_site_banners' }, refresh).subscribe();
    // Reconcile missed Realtime messages after inactive tabs or intermittent networks.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

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

  const onSwipeStart = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
    pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
    setIsSwiping(true);
  };

  const onSwipeEnd = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    if (start?.id === event.pointerId) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE_RATIO) {
        if (dx < 0) goNext();
        else goPrevious();
      }
    }
    pointerStartRef.current = null;
    setIsSwiping(false);
  };

  const cancelSwipe = () => {
    pointerStartRef.current = null;
    setIsSwiping(false);
  };

  if (!slides.length) return null;

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
        data-dragging={isSwiping}
        data-payment-service={slides[activeIndex].serviceCode}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={cancelSwipe}
        onLostPointerCapture={cancelSwipe}
      >
        <div className="public-hero-carousel__track" aria-live="off">
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            const heading = bn ? slide.headingBn : slide.headingEn;
            const mobileHeading = bn ? slide.mobileHeadingBn : slide.mobileHeadingEn;
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
                  {index === 0 ? (
                    <h1 id="public-home-title">
                      <span className="public-hero-copy--desktop">{heading}</span>
                      <span className="public-hero-copy--mobile">{mobileHeading}</span>
                    </h1>
                  ) : (
                    <h2>
                      <span className="public-hero-copy--desktop">{heading}</span>
                      <span className="public-hero-copy--mobile">{mobileHeading}</span>
                    </h2>
                  )}
                  <p>
                    <span className="public-hero-copy--desktop">{bn ? slide.descriptionBn : slide.descriptionEn}</span>
                    <span className="public-hero-copy--mobile">{bn ? slide.mobileDescriptionBn : slide.mobileDescriptionEn}</span>
                  </p>
                  <div className="citizen-public-hero__actions public-guest-actions">
                    <button className="citizen-public-primary public-guest-action" type="button" onClick={() => onPayTax(slide.serviceCode)}>
                      <WalletCards size={18} aria-hidden="true" />{bn ? slide.actionBn : slide.actionEn}
                    </button>
                    {index === 0 && (
                      <button className="citizen-public-secondary public-guest-action" type="button" onClick={onCheckReceipt}>
                        <Search size={18} aria-hidden="true" />
                        <span className="public-hero-copy--desktop">{bn ? 'পেমেন্ট ও রসিদ যাচাই' : 'Check payment & receipt'}</span>
                        <span className="public-hero-copy--mobile">{bn ? 'অবস্থা দেখুন' : 'Check status'}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="public-information-hero__media public-hero-carousel__media--illustrated" aria-hidden="true">
                  <picture>
                    {slide.mobileImage && <source media="(max-width: 640px)" srcSet={slide.mobileImage} />}
                    <img
                      className={`public-information-hero__image${slide.id === 'intro' ? '' : ' public-hero-carousel__service-image'}`}
                      src={slide.image}
                      alt=""
                      decoding="async"
                    />
                  </picture>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <div className="public-hero-carousel__controls" role="group" aria-label={bn ? 'ব্যানার পরিবর্তন করুন' : 'Banner navigation'}>
        <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--previous" onClick={goPrevious} aria-label={bn ? 'আগের ব্যানার' : 'Previous banner'}>
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--next" onClick={goNext} aria-label={bn ? 'পরের ব্যানার' : 'Next banner'}>
          <ChevronRight size={21} aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {bn ? `ব্যানার ${activeIndex + 1} / ${slides.length}: ${slides[activeIndex].headingBn}` : `Banner ${activeIndex + 1} of ${slides.length}: ${slides[activeIndex].headingEn}`}
      </span>
    </div>
  );
};
