import type { JSX } from 'preact';
import { t } from '../../i18n';

/** Visual variants for {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/** Props for {@link Button}. */
export interface ButtonProps {
  readonly children?: JSX.Element | string;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly type?: 'button' | 'submit';
  readonly ariaLabel?: string;
  readonly onClick?: (event: MouseEvent) => void;
}

/** An accessible button. */
export function Button({
  children,
  variant = 'secondary',
  disabled = false,
  type = 'button',
  ariaLabel,
  onClick,
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      class={`dwt-button dwt-button--${variant}`}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children ?? t('button.default')}
    </button>
  );
}
