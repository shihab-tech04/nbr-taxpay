import React, { useState } from 'react';
import { Info } from 'lucide-react';
import type { Language } from '../../types/tax';
import type { SuggestedPaymentAmount } from '../../services/paymentAmountSuggestions';

/** Reusable inline explanation. It does not make the suggested amount read-only. */
export function SuggestedAmountInfo({ suggestion, language, controlId }: {
  suggestion: SuggestedPaymentAmount;
  language: Language;
  controlId: string;
}) {
  const [open, setOpen] = useState(false);
  const bn = language === 'bn';
  const descriptionId = controlId + '-suggestion-details';
  return (
    <span className="relative inline-flex items-center" data-testid="payment-amount-suggestion-info">
      <button type="button"
        aria-label={bn ? 'এই পরিমাণ স্বয়ংক্রিয়ভাবে কেন পূরণ হয়েছে?' : 'Why was this amount filled automatically?'}
        aria-expanded={open} aria-controls={descriptionId}
        title={bn ? 'পরিমাণের উৎস' : 'About this amount'}
        onClick={() => setOpen(current => !current)}
        className="ml-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-taxpay-primary hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taxpay-primary">
        <Info aria-hidden="true" size={17} />
      </button>
      {open && <span id={descriptionId} role="note"
        className="absolute left-0 top-full z-30 mt-1 block w-64 max-w-[min(80vw,20rem)] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-700 shadow-lg">
        {bn
          ? `৳ ${suggestion.amount} পরিমাণটি User1-এর পূর্বনির্ধারিত উদাহরণ (${suggestion.id}) থেকে স্বয়ংক্রিয়ভাবে এসেছে; করবর্ষ ${suggestion.assessmentYear}। এটি এনবিআর যাচাইকৃত দাবি নয়। পরিশোধের আগে পরিমাণ মিলিয়ে প্রয়োজনে পরিবর্তন করুন।`
          : `৳ ${suggestion.amount} was filled from User1's predefined example ${suggestion.id} for assessment year ${suggestion.assessmentYear}. This is not an NBR-verified liability. Check and edit the amount before continuing.`}
      </span>}
    </span>
  );
}
