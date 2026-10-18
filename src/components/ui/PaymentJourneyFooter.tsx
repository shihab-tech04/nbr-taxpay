import type { ReactNode } from 'react';

/** Keeps stage navigation in the same left-to-right order across services. */
export function PaymentJourneyFooter({ back, next, className = '' }: { back?: ReactNode; next?: ReactNode; className?: string }) {
  return <div className={`payment-journey-footer ${className}`}>
    <div className="payment-journey-footer__back">{back}</div>
    <div className="payment-journey-footer__next">{next}</div>
  </div>;
}
