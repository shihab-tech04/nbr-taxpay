import type { ReactNode } from 'react';

/** Shared left-to-right payment footer: optional draft action, back, then primary next action. */
export function PaymentJourneyFooter({ leading, back, next, className = '' }: {
  leading?: ReactNode; back?: ReactNode; next?: ReactNode; className?: string;
}) {
  return <div className={`payment-journey-footer ${className}`}>
    {leading && <div className="payment-journey-footer__leading">{leading}</div>}
    <div className="payment-journey-footer__back">{back}</div>
    <div className="payment-journey-footer__next">{next}</div>
  </div>;
}
