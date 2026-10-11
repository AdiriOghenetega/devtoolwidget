import type { ComponentChildren, JSX } from 'preact';
import { t } from '../../i18n';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  readonly title?: string;
  readonly description?: string;
  readonly children?: ComponentChildren;
}

/** A friendly empty state with an optional action. */
export function EmptyState({ title, description, children }: EmptyStateProps): JSX.Element {
  return (
    <div class="dwt-empty-state">
      <p class="dwt-empty-state__title">{title ?? t('emptyState.title')}</p>
      {description !== undefined && <p class="dwt-empty-state__description">{description}</p>}
      {children !== undefined && <div class="dwt-empty-state__action">{children}</div>}
    </div>
  );
}
