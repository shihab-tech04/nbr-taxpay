import React, { createContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/** Portal target for workflow-owned footer actions; the modal still owns its close control. */
export const TaxPayModalFooterTarget = createContext<HTMLDivElement | null>(null);
import { ArrowLeft, X } from 'lucide-react';

export interface TaxPayModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeIconLabel?: string;
  className?: string;
  service?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Stable workflow identity while the visible title changes per step. */
  ariaLabel?: string;
  /** Animate compact content-height changes without changing payment-stage scrolling. */
  animateSize?: boolean;
  /** Current inner screen; re-observe when the screen's element changes. */
  motionKey?: string;
  /** Focus the first meaningful form control; otherwise the header close button receives focus. */
  initialFocusSelector?: string;
  /** Read-only information dialogs may omit an otherwise empty action footer. */
  hideFooter?: boolean;
  /** Only the four payment stages use the progressive modal shell. */
  progress?: { current: number; total: number; label?: string };
}

/**
 * Shared TaxPay modal shell.
 * Header/title + one close control; optional action footer and scrolling body.
 * Feature-specific forms and actions remain with their respective screens.
 * No default bottom Close action: the header X dismisses read-only dialogs.
 */
export function TaxPayModal({
  title,
  onClose,
  children,
  footer,
  closeIconLabel = 'Close modal',
  className = '',
  service,
  onBack,
  backLabel = 'Back',
  ariaLabel,
  animateSize = false,
  motionKey,
  initialFocusSelector,
  hideFooter = false,
  progress,
}: TaxPayModalProps) {
  const titleId = useId();
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const initialControl = initialFocusSelector ? dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector) : null;
    (initialControl ?? closeRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // A login opened by this payment flow owns keyboard focus until it closes.
      if (document.querySelector('.taxpayer-login-backdrop, .tax-service-auth-overlay')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const candidates = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(element => element.getClientRects().length > 0);
      if (candidates.length === 0) {
        event.preventDefault();
        return;
      }
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useLayoutEffect(() => {
    if (!animateSize) {
      setContentHeight(null);
      return;
    }
    const body = bodyRef.current;
    const header = headerRef.current;
    const footer = footerRef.current;
    const content = body?.firstElementChild as HTMLElement | null;
    if (!body || !header || !content) return;
    // Observe natural content height, not the scrollable body's constrained height.
    // This allows the modal to animate both expansion and contraction.
    const measure = () => {
      const styles = getComputedStyle(body);
      const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const available = Math.max(0, window.innerHeight - (window.innerWidth <= 650 ? 0 : 32));
      const natural = Math.ceil(header.offsetHeight + (footer?.offsetHeight ?? 0) + content.scrollHeight + padding + 2);
      const next = Math.min(available, natural);
      setContentHeight(previous => previous === next ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(header);
    if (footer) observer.observe(footer);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [animateSize, motionKey]);

  return (
    <TaxPayModalFooterTarget.Provider value={footerTarget}>
    <div
      className="taxpay-modal__overlay public-service-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className={`taxpay-modal public-service-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        data-public-service={service}
        data-payment-stage={progress ? "true" : undefined}
        data-size-motion={animateSize ? 'true' : undefined}
        style={animateSize && contentHeight !== null ? { height: contentHeight } : undefined}
        ref={dialogRef}
      >
        <header ref={headerRef} className="taxpay-modal__header public-service-dialog__header">
          {onBack ? <button type="button" className="taxpay-modal__back" aria-label={backLabel} onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button> : <span className="taxpay-modal__back-placeholder" aria-hidden="true" />}
          {progress ? <div className="taxpay-modal__heading">
            <h2 className="taxpay-modal__title" id={titleId}>{title}</h2>
            <p className="taxpay-modal__step-count">{progress.current}/{progress.total} {progress.label ?? 'Steps'}</p>
          </div> : <h2 className="taxpay-modal__title" id={titleId}>{title}</h2>}
          <button
            ref={closeRef}
            type="button"
            className="taxpay-modal__close"
            onClick={onClose}
            aria-label={closeIconLabel}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {progress && <div className="taxpay-modal__progress" role="progressbar"
          aria-label="Payment progress" aria-valuemin={0} aria-valuemax={progress.total}
          aria-valuenow={progress.current} aria-valuetext={`Step ${progress.current} of ${progress.total}`}>
          <span className="taxpay-modal__progress-fill" style={{ width: `${100 * progress.current / progress.total}%` }} />
        </div>}
        <div ref={bodyRef} className="taxpay-modal__body public-service-dialog__body">
          {children}
        </div>
        {!hideFooter && footer != null && <footer ref={footerRef} className="taxpay-modal__footer">
          {footer}
          <div className="taxpay-modal__footer-actions" ref={setFooterTarget} />
        </footer>}
      </div>
    </div>
    </TaxPayModalFooterTarget.Provider>
  );
}
