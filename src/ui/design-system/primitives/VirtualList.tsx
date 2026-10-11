import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';

/** Props for {@link VirtualList}. */
export interface VirtualListProps<T> {
  readonly items: readonly T[];
  readonly itemHeight: number;
  readonly height: number;
  readonly ariaLabel?: string;
  readonly renderItem: (item: T, index: number) => JSX.Element;
}

/**
 * A windowed list: only the visible slice (plus one overscan row) is rendered,
 * so long lists stay cheap. Scrolls within a fixed-height container.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  height,
  ariaLabel,
  renderItem,
}: VirtualListProps<T>): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) {
    return <p class="dwt-virtual-list__empty">{t('virtualList.empty')}</p>;
  }

  const overscan = 1;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visible = Math.ceil(height / itemHeight) + overscan * 2;
  const end = Math.min(items.length, start + visible);
  const windowItems = items.slice(start, end);

  return (
    <div
      ref={ref}
      class="dwt-virtual-list"
      style={{ height: `${String(height)}px`, overflowY: 'auto', position: 'relative' }}
      role="list"
      aria-label={ariaLabel ?? t('virtualList.label')}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
    >
      <div style={{ height: `${String(items.length * itemHeight)}px`, position: 'relative' }}>
        {windowItems.map((item, offset) => {
          const index = start + offset;
          return (
            <div
              key={index}
              role="listitem"
              style={{
                position: 'absolute',
                top: `${String(index * itemHeight)}px`,
                height: `${String(itemHeight)}px`,
                left: '0',
                right: '0',
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
