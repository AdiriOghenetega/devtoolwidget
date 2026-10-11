import type { JSX } from 'preact';

/** One option in a {@link Select}. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** Props for {@link Select}. */
export interface SelectProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly id?: string;
  readonly onChange?: (value: string) => void;
}

/** A labelled native select. */
export function Select({ label, options, value, id, onChange }: SelectProps): JSX.Element {
  const selectId = id ?? 'dwt-select';
  return (
    <label class="dwt-select" for={selectId}>
      <span class="dwt-select__label">{label}</span>
      <select
        id={selectId}
        class="dwt-select__control"
        value={value}
        onChange={(event) => {
          onChange?.(event.currentTarget.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
