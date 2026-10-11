import type { ComponentChildren, JSX } from 'preact';
import { t } from '../../i18n';

/** Props for {@link IconButton}. */
export interface IconButtonProps {
  readonly ariaLabel?: string;
  readonly children?: ComponentChildren;
  readonly disabled?: boolean;
  readonly onClick?: (event: MouseEvent) => void;
}

/** A button whose only content is an icon; requires an accessible name. */
export function IconButton({
  ariaLabel,
  children,
  disabled = false,
  onClick,
}: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class="dwt-icon-button"
      aria-label={ariaLabel ?? t('iconButton.label')}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
