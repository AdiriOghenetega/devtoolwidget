import type { JSX } from 'preact';

/** Props for {@link Checkbox}. */
export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly id?: string;
  readonly onChange?: (checked: boolean) => void;
}

/** A labelled checkbox. */
export function Checkbox({ label, checked, id, onChange }: CheckboxProps): JSX.Element {
  const checkboxId = id ?? 'dwt-checkbox';
  return (
    <label class="dwt-checkbox" for={checkboxId}>
      <input
        id={checkboxId}
        type="checkbox"
        class="dwt-checkbox__input"
        checked={checked}
        onChange={(event) => {
          onChange?.(event.currentTarget.checked);
        }}
      />
      <span class="dwt-checkbox__label">{label}</span>
    </label>
  );
}
