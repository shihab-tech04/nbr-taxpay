import React from 'react';
import { useTaxState } from '../../services/taxState';

const activitySections = [
  { route: 'history', en: 'Transactions', bn: 'লেনদেনসমূহ' },
  { route: 'history', trackPayment: true, en: 'Track payment', bn: 'পেমেন্ট অনুসন্ধান' },
  { route: 'corrections', en: 'Issues & corrections', bn: 'সমস্যা ও সংশোধন' },
  { route: 'certificates', en: 'Receipts & certificates', bn: 'রসিদ ও সনদপত্র' },
] as const;

/** Shared heading pattern for taxpayer pages and guest-accessible Beneficiaries. */
export function TaxpayerPageHeading({ title, description, actions, id, className = '' }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return <header className={'taxpayer-page-heading ' + className}>
    <div className="taxpayer-page-heading__copy">
      <h1 id={id}>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="taxpayer-page-heading__actions">{actions}</div>}
  </header>;
}

export function TaxpayerActivityTabs() {
  const { currentRoute, routeParams, language, navigate } = useTaxState();
  return <nav className="taxpayer-activity-sections" aria-label={language === 'bn' ? 'লেনদেনের বিভাগ' : 'Activity sections'}>
    {activitySections.map(section => <button key={section.en} type="button"
      onClick={() => navigate(section.route, section.route === 'history' ? {trackPayment: 'trackPayment' in section} : {})} aria-current={currentRoute === section.route && (section.route !== 'history' || Boolean(routeParams.trackPayment) === ('trackPayment' in section)) ? 'page' : undefined}>
      {language === 'bn' ? section.bn : section.en}
    </button>)}
  </nav>;
}
