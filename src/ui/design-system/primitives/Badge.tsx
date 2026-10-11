import type { ComponentChildren, JSX } from 'preact';
import { t } from '../../i18n';

/** Finding severities a badge can express. */
export type BadgeSeverity = 'critical' | 'warning' | 'info';

/** Props for {@link Badge}. */
export interface BadgeProps {
  readonly severity: BadgeSeverity;
  readonly children?: ComponentChildren;
}

const LABELS: Readonly<Record<BadgeSeverity, () => string>> = {
  critical: () => t('badge.critical'),
  warning: () => t('badge.warning'),
  info: () => t('badge.info'),
};

/** A small severity badge. */
export function Badge({ severity, children }: BadgeProps): JSX.Element {
  return (
    <span class={`dwt-badge dwt-badge--${severity}`} data-severity={severity}>
      {children ?? LABELS[severity]()}
    </span>
  );
}
