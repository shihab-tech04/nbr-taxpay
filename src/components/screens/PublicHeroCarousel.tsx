import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, WalletCards } from 'lucide-react';
import type { BannerPaymentService } from '../../services/taxState';
import heroPaymentIllustration from '../../assets/taxpay-hero-intro-concept-v7.webp';
import returnTaxIllustration from '../../assets/taxpay-hero-return-concept-v7.webp';
import advanceTaxIllustration from '../../assets/taxpay-hero-advance-concept-v7.webp';
import withholdingTaxIllustration from '../../assets/taxpay-hero-withholding-concept-v7.webp';
import travelTaxIllustration from '../../assets/taxpay-hero-travel-concept-v7.webp';
import { supabase } from '../../services/supabaseClient';

const AUTOPLAY_INTERVAL_MS = 8_000;
const SWIPE_THRESHOLD_PX = 45;
const SWIPE_DOMINANCE_RATIO = 1.2;

const defaultSlides = [
  {
    id: 'intro',
    serviceCode: undefined,
    headingEn: 'Tax payments, without the confusion',
    headingBn: 'কর পরিশোধে আর বিভ্রান্তি নয়।',
    mobileHeadingEn: 'Pay tax with confidence',
    mobileHeadingBn: 'কর পরিশোধ সহজ করুন',
    descriptionEn: 'Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.',
    descriptionBn: 'যে কর পরিশোধ করতে চান, সেই সেবাটি বেছে নিন। ধাপে ধাপে এগিয়ে পেমেন্টের তথ্য সংরক্ষণ করুন।',
    mobileDescriptionEn: 'Choose, pay and keep your record.',
    mobileDescriptionBn: 'কর দিন, পেমেন্টের তথ্য রাখুন।',
    actionEn: 'Pay Tax',
    actionBn: 'কর পরিশোধ',
    image: heroPaymentIllustration,
  },
  {
    id: 'return',
    serviceCode: 'TAX_WITH_RETURN',
    headingEn: 'Tax with Return',
    headingBn: 'রিটার্নের সঙ্গে কর',
    mobileHeadingEn: 'Tax with Return',
    mobileHeadingBn: 'রিটার্নের সঙ্গে কর',
    descriptionEn: 'Filing an income tax return and still have tax to pay? Make that payment here and keep its reference with your return.',
    descriptionBn: 'রিটার্ন জমা দেওয়ার সময় কর পরিশোধ বাকি আছে? এখান থেকে সেই কর দিন এবং পেমেন্টের তথ্য রিটার্নের সঙ্গে রাখুন।',
    mobileDescriptionEn: 'Pay tax due with your return.',
    mobileDescriptionBn: 'রিটার্নের বাকি কর দিন।',
    actionEn: 'Pay Tax with Return',
    actionBn: 'রিটার্নের সঙ্গে কর পরিশোধ',
    image: returnTaxIllustration,
  },
  {
    id: 'advance',
    serviceCode: 'ADVANCE_TAX',
    headingEn: 'Advance Income Tax',
    headingBn: 'অগ্রিম আয়কর',
    mobileHeadingEn: 'Advance Income Tax',
    mobileHeadingBn: 'অগ্রিম আয়কর',
    descriptionEn: 'Making an advance income tax payment? Select the assessment year, enter the amount and review the details before paying.',
    descriptionBn: 'অগ্রিম আয়কর দিতে চান? করবর্ষ ও টাকার পরিমাণ নির্বাচন করে পরিশোধের আগে তথ্য মিলিয়ে নিন।',
    mobileDescriptionEn: 'Pay ahead for your tax year.',
    mobileDescriptionBn: 'করবর্ষ বেছে অগ্রিম কর দিন।',
    actionEn: 'Pay Advance Income Tax',
    actionBn: 'অগ্রিম আয়কর পরিশোধ',
    image: advanceTaxIllustration,
  },
  {
    id: 'withholding',
    serviceCode: 'SOURCE_TAX_DEPOSIT',
    headingEn: 'Source Tax Deposit (TDS/TCS)',
    headingBn: 'উৎসে কর জমা (টিডিএস/টিসিএস)',
    mobileHeadingEn: 'Source Tax (TDS/TCS)',
    mobileHeadingBn: 'উৎসে কর জমা',
    descriptionEn: 'Deducted tax from a salary or supplier bill, or collected tax on a transaction? Deposit that tax under the applicable payment category.',
    descriptionBn: 'বেতন বা সরবরাহকারীর বিল থেকে কর কেটেছেন, কিংবা কোনো লেনদেনে কর আদায় করেছেন? প্রযোজ্য খাতে সেই কর জমা দিন।',
    mobileDescriptionEn: 'Deposit tax deducted at source.',
    mobileDescriptionBn: 'উৎসে কাটা বা আদায় করা কর দিন।',
    actionEn: 'Deposit Source Tax',
    actionBn: 'উৎসে কর জমা দিন',
    image: withholdingTaxIllustration,
  },
  {
    id: 'travel',
    serviceCode: 'TRAVEL_TAX',
    headingEn: 'Travel Tax',
    headingBn: 'ভ্রমণ কর',
    mobileHeadingEn: 'Travel Tax',
    mobileHeadingBn: 'ভ্রমণ কর',
    descriptionEn: 'Travelling abroad? Choose the journey details and enter passenger information to check and pay the applicable travel tax.',
    descriptionBn: 'বিদেশ ভ্রমণ করছেন? ভ্রমণ ও যাত্রীর তথ্য দিয়ে প্রযোজ্য ভ্রমণ কর যাচাই করে পরিশোধ করুন।',
    mobileDescriptionEn: 'Check travel tax before departure.',
    mobileDescriptionBn: 'ভ্রমণের কর যাচাই ও পরিশোধ করুন।',
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
  paused?: boolean;
};

export const PublicHeroCarousel: React.FC<PublicHeroCarouselProps> = ({
  language,
  onPayTax,
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
        aria-description={bn ? 'শুধু ডান পাশের ছবি পরিবর্তন করতে সোয়াইপ করুন অথবা তীরচিহ্ন ব্যবহার করুন।' : 'Swipe or use the arrow keys to change the right-side illustration. The payment actions remain fixed.'}
        className="public-hero-carousel"
        data-active-slide={activeIndex}
        data-dragging={isSwiping}
        data-image-service={slides[activeIndex].serviceCode}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        onPointerCancel={cancelSwipe}
        onLostPointerCapture={cancelSwipe}
      >
        <article
          className="citizen-public-hero public-information-hero public-hero-carousel__slide public-hero-carousel__fixed"
          data-banner-service="intro"
          data-banner-kind="intro"
        >
          <div className="citizen-public-hero__copy">
            <h1 id="public-home-title">
              <span className="public-hero-copy--desktop">{bn ? defaultSlides[0].headingBn : defaultSlides[0].headingEn}</span>
              <span className="public-hero-copy--mobile">{bn ? defaultSlides[0].mobileHeadingBn : defaultSlides[0].mobileHeadingEn}</span>
            </h1>
            <p>
              <span className="public-hero-copy--desktop">{bn ? defaultSlides[0].descriptionBn : defaultSlides[0].descriptionEn}</span>
              <span className="public-hero-copy--mobile">{bn ? defaultSlides[0].mobileDescriptionBn : defaultSlides[0].mobileDescriptionEn}</span>
            </p>
            <div className="citizen-public-hero__actions public-guest-actions">
              <button className="citizen-public-primary public-guest-action" type="button" onClick={() => onPayTax()} aria-label={bn ? 'কর পরিশোধ' : 'Pay Tax'}>
                <WalletCards size={18} aria-hidden="true" />
                <span className="public-hero-carousel__pay-full">{bn ? 'কর পরিশোধ' : 'Pay Tax'}</span>
                <span className="public-hero-carousel__pay-compact" aria-hidden="true">{bn ? 'কর দিন' : 'Pay Tax'}</span>
              </button>
              <button className="public-guest-action public-hero-carousel__travel" type="button" onClick={() => onPayTax('TRAVEL_TAX')} aria-label={bn ? 'ভ্রমণ কর পরিশোধ' : 'Pay Travel Tax'}>
                <WalletCards size={18} aria-hidden="true" />
                <span className="public-hero-carousel__travel-full">{bn ? 'ভ্রমণ কর পরিশোধ' : 'Pay Travel Tax'}</span>
                <span className="public-hero-carousel__travel-compact" aria-hidden="true">{bn ? 'ভ্রমণ কর' : 'Travel Tax'}</span>
              </button>
            </div>
          </div>
          <div className="public-information-hero__media public-hero-carousel__media--illustrated" aria-hidden="true">
            {slides.map((slide, index) => (
              <picture key={slide.id} className="public-hero-carousel__image-layer" data-visible={index === activeIndex}>
                {slide.mobileImage && <source media="(max-width: 640px)" srcSet={slide.mobileImage} />}
                <img className="public-information-hero__image public-hero-carousel__service-image" src={slide.image} alt="" decoding="async" />
              </picture>
            ))}
          </div>
        </article>
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
        {bn ? `ব্যানার ${activeIndex + 1} / ${slides.length}: ${slides[activeIndex].headingBn}` : `Illustration ${activeIndex + 1} of ${slides.length}: ${slides[activeIndex].headingEn}`}
      </span>
    </div>
  );
};
