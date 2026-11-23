import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';

/**
 * Presentation-only selected-identity rail shared by parallel Taxpayer and
 * Travel Tax. The caller retains lookup, validation, selection and deletion.
 * Prefix-specific classes preserve the existing approved pixel geometry.
 */
export function SelectedIdentityRail({
  prefix, label, count, emptyLabel, children, countTestId,
  titleIconSize = 17, emptyIconSize = 18, announceCount = false,
  className = '', testId,
}: {
  prefix: string;
  label: string;
  count: number;
  emptyLabel: string;
  children: ReactNode;
  countTestId?: string;
  titleIconSize?: number;
  emptyIconSize?: number;
  announceCount?: boolean;
  /** Optional consumer hooks; existing taxpayer/travel rails remain unchanged. */
  className?: string;
  testId?: string;
}) {
  return <aside className={[prefix + '__rail', className].filter(Boolean).join(' ')}
    aria-label={label} data-testid={testId}>
    <h3 className={prefix + '__rail-title'}>
      <UserRound size={titleIconSize} aria-hidden="true"/>
      {label}
      <span {...(announceCount ? {'aria-live': 'polite' as const} : {})}
        data-testid={countTestId}>{count}</span>
    </h3>
    <div className={prefix + '__list'}>
      {count === 0 && <div className={prefix + '__selected-empty'}>
        <UserRound size={emptyIconSize} aria-hidden="true"/>
        <strong>{emptyLabel}</strong>
      </div>}
      {children}
    </div>
  </aside>;
}
