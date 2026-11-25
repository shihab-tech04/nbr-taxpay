import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ReceiptText, WalletCards } from 'lucide-react';
import type { BannerPaymentService } from '../../services/taxState';
import heroPaymentIllustration from '../../assets/taxpay-hero-intro-v9.webp';
import returnTaxIllustration from '../../assets/taxpay-hero-return-v9.webp';
import advanceTaxIllustration from '../../assets/taxpay-hero-advance-v9.webp';
import withholdingTaxIllustration from '../../assets/taxpay-hero-withholding-v9.webp';
import travelTaxIllustration from '../../assets/taxpay-hero-travel-v9.webp';
import { supabase } from '../../services/supabaseClient';
import { brandingReadsAllowed, noteBrandingResponse } from '../../services/brandingCmsHealth';

const AUTOPLAY_INTERVAL_MS = 8_000;
const CMS_FALLBACK_POLL_MS = 5 * 60_000;
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
  backgroundColor?: string | null; headingColor?: string | null;
  bodyColor?: string | null; outlineColor?: string | null;
};

const fallbackSlides: BannerSlide[] = defaultSlides.map(slide => ({ ...slide }));

/**
 * Last checksum-verified approved publication. Shown while the authoritative
 * V2 CMS metadata is loading or temporarily restricted; never shipped as
 * fabricated backend data. SQL remains the publishing authority.
 */
const lastVerifiedPublished: Record<string, {
  file: string; path: string; background: string; heading: string; body: string; outline: string
}> = {
  intro: { file: 'banner-intro.jpg', path: 'banners/intro/c6bd8f1e-611d-4691-932f-9b6812f46085.jpg',
    background: '#F7F5E6', heading: '#65531B', body: '#6D5F31', outline: '#7A651F' },
  return: { file: 'banner-return.png', path: 'banners/return/ffa907f6-1ee0-4ebb-86a1-f75392849905.png',
    background: '#ECF8FC', heading: '#1B4D65', body: '#315A6D', outline: '#1F5D7A' },
  advance: { file: 'banner-advance.png', path: 'banners/advance/4ecafe03-442a-4b58-9da8-ca577d34b3a1.png',
    background: '#FAF1DD', heading: '#65501B', body: '#6D5C31', outline: '#7A611F' },
  withholding: { file: 'banner-withholding.png', path: 'banners/withholding/1affb273-1f0e-4cdf-bcb4-e06d5c1e15e8.png',
    background: '#F8E7F6', heading: '#651B63', body: '#6D316C', outline: '#7A1F78' },
  travel: { file: 'banner-travel.png', path: 'banners/travel/5a02e106-bcc0-4aba-8021-6520d289c009.png',
    background: '#ECF8FC', heading: '#07516B', body: '#316078', outline: '#0C6D8D' },
};
const publishedBackup: BannerSlide[] = fallbackSlides.map(slide => {
  const verified = lastVerifiedPublished[slide.id];
  return { ...slide, image: `${import.meta.env.BASE_URL}branding/published/${verified.file}`,
    backgroundColor: verified.background, headingColor: verified.heading,
    bodyColor: verified.body, outlineColor: verified.outline };
});


/** Keep the approved v9 media and layout even if a published Storage object is missing. */
function BannerPicture({ slide, visible, preload, onVisibleReady, mobileMaxWidth = 640 }: {
  slide: BannerSlide; visible: boolean; preload: boolean; onVisibleReady: () => void; mobileMaxWidth?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  // Never give the browser a URL for unpublished/inactive artwork at startup.
  // Once visited or prepared, retain the image through the approved dissolve.
  const [requested, setRequested] = useState(visible || preload);
  const shouldRequest = requested || visible || preload;
  useEffect(() => {
    if (visible || preload) setRequested(true);
  }, [visible, preload]);
  // The keyed picture already retries when CMS changes its image URL. Also
  // retry an unchanged URL after a temporary network/storage outage recovers.
  useEffect(() => {
    if (!imageFailed) return;
    const retry = () => setImageFailed(false);
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [imageFailed]);
  const fallbackImage = publishedBackup.find(value =>
    (value.serviceCode || null) === (slide.serviceCode || null))?.image || heroPaymentIllustration;
  const resolvedImage = imageFailed ? fallbackImage : slide.image;
  return <picture className="public-hero-carousel__image-layer" data-visible={visible}>
    {!imageFailed && slide.mobileImage && <source media={"(max-width: " + mobileMaxWidth + "px)"}
      srcSet={shouldRequest ? slide.mobileImage : undefined} />}
    <img className="public-information-hero__image public-hero-carousel__service-image"
      src={shouldRequest ? resolvedImage : undefined} data-deferred-src={resolvedImage}
      alt="" decoding="async" loading={visible || preload ? 'eager' : 'lazy'}
      fetchPriority={visible ? 'high' : 'low'}
      onLoad={() => { if (visible) onVisibleReady(); }}
      onError={() => setImageFailed(true)} />
  </picture>;
}

/** Keep the already-approved small-screen shortcuts only for the original action labels. */
function compactAction(actual: string, original: string, compact: string): string {
  return actual === original ? compact : actual;
}

function publicBannerImage(path: string | null, fallback: string): string {
  if (!path || !supabase) return fallback;
  // The known published image is already part of the app's immutable, checked
  // bundle. Avoid repeated 4MB+ Supabase Storage egress on carousel rotation.
  const snapshot = Object.values(lastVerifiedPublished).find(item => item.path === path);
  if (snapshot) return `${import.meta.env.BASE_URL}branding/published/${snapshot.file}`;
  return supabase.storage.from('taxpay-banners').getPublicUrl(path).data.publicUrl;
}

async function fetchPublishedBanners(): Promise<BannerSlide[]> {
  // Isolated development/Playwright runs intentionally disable Supabase.
  // Keep deterministic local artwork for visual regression only; production
  // must never resurrect unpublished CMS banners when the backend is absent.
  if (!supabase && import.meta.env.DEV && import.meta.env.VITE_SUPABASE_DISABLED === 'true') {
    return fallbackSlides;
  }
  if (!supabase) throw new Error('The public banner service is unavailable.');
  const { data, error, status } = await supabase.from('taxpay_site_banners').select('*')
    .eq('published', true).order('sort_order', { ascending: true });
  noteBrandingResponse(status, Boolean(error));
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
      backgroundColor: row.background_color, headingColor: row.heading_color,
      bodyColor: row.body_color, outlineColor: row.outline_color,
    };
  });
}


/** Slider 2 shares the published banner contract and controller. When a legacy
 * row has no complete image palette, use the existing CMS preview service colors. */
const slider2FallbackThemes: Record<string, readonly [string, string, string, string]> = {
  intro: ['#EAF2FF', '#172033', '#5F6B7A', '#2C5EAD'],
  TAX_WITH_RETURN: ['#EEF4FF', '#214887', '#4D6486', '#315DAA'],
  ADVANCE_TAX: ['#FFF6EC', '#80420D', '#765334', '#A65B19'],
  SOURCE_TAX_DEPOSIT: ['#F6F1FC', '#4E327B', '#5A4673', '#6D4BA8'],
  TRAVEL_TAX: ['#ECF8FC', '#07516B', '#316078', '#0C6D8D'],
};
function slider2Theme(slide?: BannerSlide): React.CSSProperties {
  const values = [slide?.backgroundColor, slide?.headingColor, slide?.bodyColor, slide?.outlineColor];
  const [background, heading, body, outline] = values.every(value =>
    typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))
    ? values as string[]
    : slider2FallbackThemes[slide?.serviceCode || 'intro'] || slider2FallbackThemes.intro;
  return { '--slider2-bg': background, '--slider2-heading': heading,
    '--slider2-body': body, '--slider2-outline': outline } as React.CSSProperties;
}

type PublicHeroCarouselProps = {
  language: 'en' | 'bn';
  onPayTax: (service?: BannerPaymentService) => void;
  onOtherTax: () => void;
  paused?: boolean;
  variant?: 'original' | 'home2';
};

export const PublicHeroCarousel: React.FC<PublicHeroCarouselProps> = ({
  language,
  onPayTax,
  onOtherTax,
  paused = false,
  variant = 'original',
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slides, setSlides] = useState<BannerSlide[]>(publishedBackup);
  const activeBannerId = useRef<string | null>(null);
  const lastPublishedSignature = useRef<string | null>(null);
  const [bannerStatus, setBannerStatus] = useState<'loading' | 'ready' | 'unavailable'>('ready');
  const [retryNonce, setRetryNonce] = useState(0);
  // The next slide may preload only after the visible banner's image finishes.
  // This prevents five simultaneous images from competing for first paint on 4G.
  const [visibleImageReady, setVisibleImageReady] = useState(false);
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
    activeBannerId.current = slides[activeIndex]?.id ?? null;
  }, [slides, activeIndex]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastRefreshStart = 0;
    // CMS remains live through bounded reads; no branding WebSocket is opened.
    // The former socket could reconnect dozens of times per second after 402.
    const refresh = () => {
      if (!active || inFlight || !brandingReadsAllowed()) return;
      const now = Date.now();
      if (lastRefreshStart && now - lastRefreshStart < 60_000) return;
      inFlight = true;
      lastRefreshStart = now;
      void fetchPublishedBanners().then(next => {
        if (!active) return;
        const signature = JSON.stringify(next);
        if (signature !== lastPublishedSignature.current) {
          lastPublishedSignature.current = signature;
          const keepId = activeBannerId.current;
          setSlides(next);
          setActiveIndex(index => {
            const retained = next.findIndex(slide => slide.id === keepId);
            return retained >= 0 ? retained : Math.min(index, Math.max(0, next.length - 1));
          });
        }
        setBannerStatus(next.length ? 'ready' : 'unavailable');
      }).catch(() => {
        if (!active) return;
        noteBrandingResponse(undefined, true);
        // Never replace the latest known published artwork with an empty error
        // panel due to temporary service failure. Healthy SQL can still unpublish.
        setBannerStatus('ready');
      }).finally(() => { inFlight = false; });
    };
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(onVisible, CMS_FALLBACK_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [retryNonce]);

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


  // Opt-in Home 2 presentation only. The original slider below and the
  // shared CMS reads, image recovery, autoplay, and input behavior stay intact.
  if (variant === 'home2') {
    const index = Math.min(activeIndex, Math.max(0, slides.length - 1));
    const current = slides[index];
    const fixed = slides.find(slide => !slide.serviceCode) ?? fallbackSlides[0];
    const heading = bn ? fixed.headingBn : fixed.headingEn;
    const mobileHeading = bn ? fixed.mobileHeadingBn : fixed.mobileHeadingEn;
    const action = bn ? fixed.actionBn : fixed.actionEn;
    const controls = slides.length > 1 && (
      <div className="home2-slider2__controls" role="group"
        aria-label={bn ? 'ব্যানার পরিবর্তন করুন' : 'Banner navigation'}>
        <button type="button" className="home2-slider2__arrow home2-press" onClick={goPrevious}
          aria-label={bn ? 'আগের স্লাইড' : 'Previous slide'}><ChevronLeft size={18} aria-hidden="true"/></button>
        <div className="home2-slider2__dots">
          {slides.map((slide, i) => <button type="button" key={slide.id}
            className="home2-slider2__dot" aria-current={i === index}
            aria-label={bn ? 'স্লাইড ' + (i + 1) : 'Go to slide ' + (i + 1)}
            onClick={() => setActiveIndex(i)}><span aria-hidden="true"/></button>)}
        </div>
        <button type="button" className="home2-slider2__arrow home2-press" onClick={goNext}
          aria-label={bn ? 'পরের স্লাইড' : 'Next slide'}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>
    );
    return <div className="home2-slider2" data-testid="slider2" ref={containerRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setIsHovered(false); }}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={event => { if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setHasFocus(false); }}>
      <section ref={carouselRef} className="home2-slider2__frame" data-testid="home2-desktop-hero"
        role="region" aria-roledescription="carousel" tabIndex={0}
        aria-label={bn ? 'কর পরিশোধের সেবা ব্যানার' : 'Tax payment service banners'}
        aria-description={bn ? 'ছবি ও রং পরিবর্তন করতে সোয়াইপ করুন বা তীরচিহ্ন ব্যবহার করুন।' : 'Swipe or use the arrow keys to change banner images and colors.'}
        data-active-slide={index} data-payment-service={current?.serviceCode}
        data-banner-id={current?.id} data-banner-count={slides.length}
        style={slider2Theme(current)}
        onKeyDown={onKeyDown} onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd}
        onPointerCancel={cancelSwipe} onLostPointerCapture={cancelSwipe}>
        <div className="home2-slider2__artwork" aria-hidden="true">
          {slides.map((slide, i) => <div key={slide.id} className="home2-slider2__layer"
            data-testid="slider2-artwork" data-active={i === index} data-banner-id={slide.id}
            data-payment-service={slide.serviceCode} style={slider2Theme(slide)}>
            <BannerPicture key={slide.id + ':' + slide.image + ':' + (slide.mobileImage || '')}
              slide={slide} visible={i === index}
              preload={visibleImageReady && i === (index + 1) % slides.length}
              mobileMaxWidth={959} onVisibleReady={() => setVisibleImageReady(true)}/>
          </div>)}
        </div>
        <div className="home2-slider2__copy" data-testid="home2-hero-copy">
          <div data-testid="home2-primary-slide" className="home2-slider2__content">
            <h1>{slides.length ? <>
              <span className="home2-slider2__desktop-copy">{heading}</span>
              <span className="home2-slider2__mobile-copy">{mobileHeading}</span>
            </> : (bn ? 'কর পরিশোধ' : 'Tax payments')}</h1>
            <p>{slides.length ? <>
              <span className="home2-slider2__desktop-copy">{bn ? fixed.descriptionBn : fixed.descriptionEn}</span>
              <span className="home2-slider2__mobile-copy">{bn ? fixed.mobileDescriptionBn : fixed.mobileDescriptionEn}</span>
            </> : (bn ? 'ব্যানারের তথ্য পাওয়া যাচ্ছে না। কর পরিশোধ সেবা চালু আছে।' : 'Banner information is temporarily unavailable. Payment services are still accessible.')}</p>
            <div className="home2-slider2__actions">
              <button type="button" data-testid="home2-pay" className="home2-slider2__pay home2-press"
                onClick={() => onPayTax()}><WalletCards size={18} aria-hidden="true"/>{slides.length ? action : (bn ? 'কর পরিশোধ' : 'Pay Tax')}</button>
              <button type="button" data-testid="home2-other" className="home2-slider2__other home2-press"
                onClick={onOtherTax}><ReceiptText size={18} aria-hidden="true"/>{bn ? 'অন্যান্য কর' : 'Other Tax'}</button>
            </div>
            {!slides.length && bannerStatus === 'unavailable' && <button type="button"
              className="home2-slider2__retry" onClick={() => { setBannerStatus('loading'); setRetryNonce(n => n + 1); }}>
              {bn ? 'আবার চেষ্টা করুন' : 'Retry banner loading'}</button>}
          </div>
        </div>
      </section>
      {controls}
      {slides.length > 0 && <span className="sr-only" role="status" aria-live="polite">
        {bn ? 'ব্যানার ' + (index + 1) + ' / ' + slides.length + ': ' + current.headingBn
          : 'Banner ' + (index + 1) + ' of ' + slides.length + ': ' + current.headingEn}
      </span>}
    </div>;
  }

  if (!slides.length) {
    // An unverified client fallback must never override SQL publish status.
    // Preserve functional payment entrypoints without showing any banner image.
    return <div className="public-hero-carousel-shell  public-hero-carousel--offline">
      <section className="public-hero-carousel" role="region"
        aria-label={bn ? 'কর পরিশোধের সেবা ব্যানার' : 'Tax payment service banners'}
        tabIndex={0}>
        <article className="citizen-public-hero public-information-hero public-hero-carousel__slide public-hero-carousel__fixed"
          data-banner-service="intro" data-banner-kind="intro">
        <div className="citizen-public-hero__copy">
          
          <h1 id="public-home-title">{bn ? 'কর পরিশোধ' : 'Tax payments'}</h1>
          <p role="status">{bannerStatus === 'loading'
            ? (bn ? 'ব্যানার লোড হচ্ছে…' : 'Loading banner information…')
            : (bn ? 'ব্যানারের তথ্য পাওয়া যাচ্ছে না। কর পরিশোধ সেবা চালু আছে।' : 'Banner information is temporarily unavailable. Payment services are still accessible.')}</p>
          <div className="citizen-public-hero__actions public-guest-actions">
            <button type="button" className="citizen-public-primary public-guest-action"
              onClick={() => onPayTax()}>{bn ? 'কর পরিশোধ' : 'Pay Tax'}</button>
            <button type="button" className="public-guest-action"
              onClick={onOtherTax}>{bn ? 'অন্যান্য কর' : 'Other Tax'}</button>
          </div>
          {bannerStatus === 'unavailable' && <button className="public-hero-carousel__retry"
            type="button" onClick={() => {setBannerStatus('loading');setRetryNonce(n => n + 1);}}>
            {bn ? 'আবার চেষ্টা করুন' : 'Retry banner loading'}
          </button>}
        </div>
        </article>
      </section>
    </div>;
  }
  // Keep the approved two primary payment buttons and canonical introductory copy stationary.
  // SQL still controls each published slide's artwork, ordering, and image palette.
  const fixedBanner = slides.find(slide => !slide.serviceCode) ?? fallbackSlides[0];
  // The carousel border follows the currently published service theme,
  // while the global brand controls and the main Pay Tax CTA remain fixed.
  const activeSlide = slides[activeIndex];
  const activeOutline = activeSlide.serviceCode && [
    activeSlide.backgroundColor, activeSlide.headingColor,
    activeSlide.bodyColor, activeSlide.outlineColor,
  ].every(value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))
    ? activeSlide.outlineColor : null;

  return (
    <div
      ref={containerRef}
      className="public-hero-carousel-shell "
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
        aria-description={bn ? 'ছবি ও রং পরিবর্তন করতে সোয়াইপ করুন বা তীরচিহ্ন ব্যবহার করুন। কর পরিশোধ ও অন্যান্য করের বোতাম অপরিবর্তিত থাকবে।' : 'Swipe or use the arrow keys to change banner images and colors. Pay Tax and Other Tax remain available on every slide.'}
        className="public-hero-carousel"
        data-active-slide={activeIndex}
        data-dragging={isSwiping}
        data-payment-service={slides[activeIndex].serviceCode}
        data-active-palette={activeOutline ? 'image' : undefined}
        style={activeOutline ? { borderColor: activeOutline } : undefined}
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
            const intro = !slide.serviceCode;
            const heading = bn ? fixedBanner.headingBn : fixedBanner.headingEn;
            const mobileHeading = bn ? fixedBanner.mobileHeadingBn : fixedBanner.mobileHeadingEn;
            const action = bn ? fixedBanner.actionBn : fixedBanner.actionEn;
            // NULL palette preserves the existing approved service tokens.
            const validHex = (value: string | null | undefined) =>
              typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
            const hasPalette = validHex(slide.backgroundColor) && validHex(slide.headingColor) &&
              validHex(slide.bodyColor) && validHex(slide.outlineColor);
            const paletteStyle = hasPalette ? {
              '--banner-bg': slide.backgroundColor,
              '--banner-heading': slide.headingColor,
              '--banner-body': slide.bodyColor,
              '--banner-outline': slide.outlineColor,
            } as React.CSSProperties : undefined;
            return (
              <article
                key={slide.id}
                className="citizen-public-hero public-information-hero public-hero-carousel__slide"
                data-banner-service={intro ? 'intro' : slide.id}
                data-banner-kind={intro ? 'intro' : 'service'}
                data-fixed-left="true"
                data-active={isActive}
                data-payment-service={slide.serviceCode}
                data-banner-palette={hasPalette ? 'image' : undefined}
                style={paletteStyle}
                role="group"
                aria-roledescription="slide"
                aria-label={bn ? `ব্যানার ${index + 1} / ${slides.length}` : `Slide ${index + 1} of ${slides.length}`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                <div className="citizen-public-hero__copy">
                  
                  {intro ? (
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
                    <span className="public-hero-copy--desktop">{bn ? fixedBanner.descriptionBn : fixedBanner.descriptionEn}</span>
                    <span className="public-hero-copy--mobile">{bn ? fixedBanner.mobileDescriptionBn : fixedBanner.mobileDescriptionEn}</span>
                  </p>
                  <div className="citizen-public-hero__actions public-guest-actions">
                    <button className="citizen-public-primary public-guest-action" type="button"
                      onClick={() => onPayTax()}
                      aria-label={action}>
                      <WalletCards size={18} aria-hidden="true" />
                      <>
                          <span className="public-hero-carousel__pay-full">{action}</span>
                          <span className="public-hero-carousel__pay-compact" aria-hidden="true">
                            {bn ? compactAction(action, fallbackSlides[0].actionBn, 'কর দিন')
                              : compactAction(action, fallbackSlides[0].actionEn, 'Pay Tax')}
                          </span>
                      </>
                    </button>
                    <button className="public-guest-action public-hero-carousel__travel" type="button"
                      onClick={onOtherTax} aria-label={bn ? 'অন্যান্য কর' : 'Other Tax'}>
                      <ReceiptText size={18} aria-hidden="true" />
                      <span className="public-hero-carousel__travel-full">{bn ? 'অন্যান্য কর' : 'Other Tax'}</span>
                      <span className="public-hero-carousel__travel-compact" aria-hidden="true">{bn ? 'অন্যান্য কর' : 'Other Tax'}</span>
                    </button>
                  </div>
                </div>
                <div className="public-information-hero__media public-hero-carousel__media--illustrated" aria-hidden="true">
                  <BannerPicture key={`${slide.id}:${slide.image}:${slide.mobileImage || ''}`}
                    slide={slide} visible={isActive}
                    preload={visibleImageReady && index === (activeIndex + 1) % slides.length}
                    onVisibleReady={() => setVisibleImageReady(true)} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {slides.length > 1 && <div className="public-hero-carousel__controls" role="group"
        aria-label={bn ? 'ব্যানার পরিবর্তন করুন' : 'Banner navigation'}>
        <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--previous"
          onClick={goPrevious} aria-label={bn ? 'আগের ব্যানার' : 'Previous banner'}>
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <button type="button" className="public-hero-carousel__arrow public-hero-carousel__arrow--next"
          onClick={goNext} aria-label={bn ? 'পরের ব্যানার' : 'Next banner'}>
          <ChevronRight size={21} aria-hidden="true" />
        </button>
      </div>}
      <span className="sr-only" role="status" aria-live="polite">
        {bn
          ? `ব্যানার ${activeIndex + 1} / ${slides.length}: ${slides[activeIndex].headingBn}`
          : `Banner ${activeIndex + 1} of ${slides.length}: ${slides[activeIndex].headingEn}`}
      </span>
    </div>
  );
};
