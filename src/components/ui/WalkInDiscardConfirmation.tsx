import { useEffect, useId, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { Language } from '../../types/tax';

/**
 * The one destructive-exit confirmation for an unfinished signed-out Walk-in
 * Payment. Payment entry owns when it opens; this component owns its accessible
 * dialog, focus trapping and the two approved actions. Never offer Save Draft.
 */
export function WalkInDiscardConfirmation({
  language, onKeepEditing, onDiscard,
}: {
  language: Language;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const keepButton = useRef<HTMLButtonElement>(null);
  const bn = language === 'bn';
  const t = (en: string, bangla: string) => bn ? bangla : en;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keepButton.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      data-testid="walkin-payment-exit-overlay"
      onMouseDown={event => event.stopPropagation()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="box-border w-full max-w-[520px] max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain rounded-2xl border border-taxpay-border bg-white p-5 shadow-2xl sm:p-6"
        onKeyDown={event => {
          if (event.key !== 'Escape' && event.key !== 'Tab') return;
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            onKeepEditing();
            return;
          }
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          if (!controls.length) { event.preventDefault(); return; }
          if (event.shiftKey && document.activeElement === controls[0]) {
            event.preventDefault();
            controls[controls.length - 1].focus();
          } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
            event.preventDefault();
            controls[0].focus();
          }
        }}>
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-taxpay-primary/10 text-taxpay-primary" aria-hidden="true">
            <Trash2 size={19} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="m-0 text-lg font-semibold leading-6 text-taxpay-dark">
              {t('Discard tax payment?', 'কর পরিশোধ বাদ দেবেন?')}
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-taxpay-muted">
              {t('Discarding will erase the details entered for this walk-in payment. Keep editing to continue.',
                 'বাদ দিলে এই ওয়াক-ইন পেমেন্টের দেওয়া তথ্য মুছে যাবে। চালিয়ে যেতে সম্পাদনা করুন।')}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2"
          data-testid="walkin-payment-exit-cta-row">
          <button ref={keepButton} type="button"
            className="min-h-11 w-full rounded-lg bg-taxpay-primary px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-taxpay-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
            onClick={onKeepEditing}>
            {t('Keep editing', 'সম্পাদনা চালিয়ে যান')}
          </button>
          <button type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-error/40 bg-white px-3 py-2.5 text-sm font-semibold text-taxpay-error transition-colors hover:bg-taxpay-error/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
            onClick={onDiscard}>
            <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('Discard tax payment', 'কর পরিশোধ বাদ দিন')}
          </button>
        </div>
      </section>
    </div>
  );
}
