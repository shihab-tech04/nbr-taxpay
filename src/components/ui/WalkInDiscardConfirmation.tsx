import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

type Props = {
  language: 'en' | 'bn';
  onKeepEditing: () => void;
  onDiscard: () => void;
};

/** The single reusable destructive-exit confirmation for signed-out walk-in payments.
 * Nothing is discarded until the user explicitly confirms.
 */
export function WalkInDiscardConfirmation({ language, onKeepEditing, onDiscard }: Props) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  useEffect(() => {
    const formerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keepRef.current?.focus();
    return () => {
      if (formerFocus?.isConnected) formerFocus.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      data-testid="walkin-payment-exit-overlay" onMouseDown={event => event.stopPropagation()}>
      <div ref={dialogRef} role="alertdialog" aria-modal="true"
        aria-labelledby="walkin-discard-title" aria-describedby="walkin-discard-description"
        className="box-border max-h-[calc(100dvh-24px)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-2xl border border-taxpay-border bg-white p-5 shadow-xl sm:p-6"
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onKeepEditing();
          }
          if (event.key === 'Tab') {
            const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
            if (!buttons.length) return;
            if (event.shiftKey && document.activeElement === buttons[0]) {
              event.preventDefault();
              buttons[buttons.length - 1].focus();
            } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
              event.preventDefault();
              buttons[0].focus();
            }
          }
        }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-taxpay-primary/10 text-taxpay-primary" aria-hidden="true">
            <Trash2 size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="walkin-discard-title" className="text-lg font-semibold leading-6 text-taxpay-dark">
              {t('Discard tax payment?', 'কর পরিশোধ বাদ দেবেন?')}
            </h3>
            <p id="walkin-discard-description" className="mt-1.5 text-sm leading-6 text-taxpay-muted">
              {t('Discarding will erase the details entered for this walk-in payment. Keep editing to continue.',
                'বাদ দিলে এই ওয়াক-ইন পেমেন্টের দেওয়া তথ্য মুছে যাবে। চালিয়ে যেতে সম্পাদনা করুন।')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2"
          data-testid="walkin-payment-exit-cta-row">
          <button ref={keepRef} type="button"
            className="min-h-11 w-full rounded-lg bg-taxpay-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-taxpay-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
            onClick={onKeepEditing}>
            {t('Keep editing', 'সম্পাদনা চালিয়ে যান')}
          </button>
          <button type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-taxpay-error/40 bg-white px-4 py-2.5 text-sm font-semibold text-taxpay-error transition-colors hover:bg-taxpay-error/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary"
            onClick={onDiscard}>
            <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
            {t('Discard tax payment', 'কর পরিশোধ বাদ দিন')}
          </button>
        </div>
      </div>
    </div>
  );
}
