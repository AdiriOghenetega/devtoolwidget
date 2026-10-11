import type { JSX } from 'preact';
import { t } from '../i18n';

/** Props for {@link HealthBadge}. */
export interface HealthBadgeProps {
  readonly score: number;
  readonly errorCount: number;
  readonly onClick?: () => void;
}

/** The minimized badge: health score plus error count, as an accessible button. */
export function HealthBadge({ score, errorCount, onClick }: HealthBadgeProps): JSX.Element {
  return (
    <button
      type="button"
      class="dwt-health-badge"
      aria-label={t('shell.badge.label', { score, errors: errorCount })}
      title={t('shell.open')}
      onClick={onClick}
    >
      <span class="dwt-health-badge__score" aria-hidden="true">
        {score}
      </span>
      <span class="dwt-health-badge__errors" aria-hidden="true">
        {errorCount}
      </span>
    </button>
  );
}
