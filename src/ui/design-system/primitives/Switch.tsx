import type { JSX } from 'preact';
import { t } from '../../i18n';

/** Props for {@link Switch}. */
export interface SwitchProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
}

/** An accessible switch built on a real button with `role="switch"`. */
export function Switch({ label, checked, onChange, disabled = false }: SwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class="dwt-switch"
      disabled={disabled}
      onClick={() => {
        onChange?.(!checked);
      }}
    >
      <span class="dwt-switch__track" aria-hidden="true" />
      <span class="dwt-switch__text">{checked ? t('switch.on') : t('switch.off')}</span>
    </button>
  );
}
