import React, { createContext, useEffect, useId, useRef, useState } from 'react';

/** Portal target for workflow-owned footer actions; the modal still owns its close control. */
export const TaxPayModalFooterTarget = createContext<HTMLDivElement | null>(null);
import { ArrowLeft, X } from 'lucide-react';

export interface TaxPayModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  closeIconLabel?: string;
  className?: string;
  service?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Stable workflow identity while the visible title changes per step. */
  ariaLabel?: string;
}

/**
 * Shared TaxPay modal shell.
 * Header/title + close, fixed header/footer with dividers, scrolling body.
 * Feature-specific forms and actions remain with their respective screens.
 */
export function TaxPayModal({
  title,
  onClose,
  children,
  footer,
  closeLabel = 'Close',
  closeIconLabel = 'Close modal',
  className = '',
  service,
  onBack,
  backLabel = 'Back',
  ariaLabel,
}: TaxPayModalProps) {
  const titleId = useId();
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

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
        ref={dialogRef}
      >
        <header className="taxpay-modal__header public-service-dialog__header">
          {onBack ? <button type="button" className="taxpay-modal__back" aria-label={backLabel} onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button> : <span className="taxpay-modal__back-placeholder" aria-hidden="true" />}
          <h2 className="taxpay-modal__title" id={titleId}>{title}</h2>
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
        <div className="taxpay-modal__body public-service-dialog__body">
          {children}
        </div>
        <footer className="taxpay-modal__footer">
          {footer ?? (
            <button className="taxpay-modal__footer-close" type="button" onClick={onClose}>
              {closeLabel}
            </button>
          )}
          <div className="taxpay-modal__footer-actions" ref={setFooterTarget} />
        </footer>
      </div>
    </div>
    </TaxPayModalFooterTarget.Provider>
  );
}
