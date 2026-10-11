import type { JSX } from 'preact';
import { t } from '../../i18n';

/** One row in a {@link KeyValue} list. */
export interface KeyValueItem {
  readonly key: string;
  readonly value: string;
}

/** Props for {@link KeyValue}. */
export interface KeyValueProps {
  readonly items: readonly KeyValueItem[];
}

/** A definition list of key/value rows; shows an empty state when there are none. */
export function KeyValue({ items }: KeyValueProps): JSX.Element {
  if (items.length === 0) {
    return <p class="dwt-keyvalue__empty">{t('keyValue.empty')}</p>;
  }
  return (
    <dl class="dwt-keyvalue">
      {items.map((item) => (
        <div class="dwt-keyvalue__row" key={item.key}>
          <dt class="dwt-keyvalue__key">{item.key}</dt>
          <dd class="dwt-keyvalue__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
