import type { ReactElement } from 'react';
import { formatCurrency } from '../../services/numberFormat';

/**
 * Travel Tax currency amount. Chromium's hosted font stack can render U+09F3
 * as a missing glyph when Poppins is used in the calculated-amount rail.
 * The visible symbol is an inline vector, while the standard currency text
 * remains available to selection, assistive technology and DOM assertions.
 * This changes no shared Taxpayer typography or number-format contract.
 */
export function TravelCurrency({ amount, language }: {
  amount: number;
  language: 'en' | 'bn';
}): ReactElement {
  const formatted = formatCurrency(amount, language);
  const number = formatted.replace(/^৳\s*/, '');
  return <span className="travel-currency" data-testid="travel-currency">
    <svg aria-hidden="true" focusable="false" className="travel-currency__mark"
      viewBox="0 0 636 800" xmlns="http://www.w3.org/2000/svg">
      <path transform="translate(0 749) scale(1 -1)" fill="currentColor"
        d="M125 749Q182 749 212 717Q230 698 239.5 665.5Q249 633 249 574V498H595V426H249V150Q249 103 261.5 86.0Q274 69 311 69Q352 69 391.0 91.5Q430 114 455.5 150.0Q481 186 481 226Q481 276 424 276Q397 276 374 270L364 338Q381 343 400.5 345.5Q420 348 440 348Q493 348 526.5 321.5Q560 295 560 236Q560 190 538.5 147.5Q517 105 481.0 71.5Q445 38 400.0 19.0Q355 0 308 0Q271 0 247.0 8.5Q223 17 207 32Q192 46 182.0 69.0Q172 92 172 146V426H75V498H172V570Q172 622 160.0 649.5Q148 677 103 677Q84 677 65.5 671.5Q47 666 34 661L7 723Q37 736 65.5 742.5Q94 749 125 749Z"/>
    </svg>
    <span className="sr-only">৳ </span><span>{number}</span>
  </span>;
}
