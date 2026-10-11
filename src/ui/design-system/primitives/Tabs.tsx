import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';

/** One tab definition. */
export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly panel?: JSX.Element | string;
}

/** Props for {@link Tabs}. */
export interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly selectedId?: string;
  readonly ariaLabel?: string;
  readonly onSelect?: (id: string) => void;
}

/** Accessible tabs with arrow-key navigation and roving tabindex. */
export function Tabs({ tabs, selectedId, ariaLabel, onSelect }: TabsProps): JSX.Element {
  const [active, setActive] = useState(selectedId ?? tabs[0]?.id ?? '');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (selectedId !== undefined) {
      setActive(selectedId);
    }
  }, [selectedId]);

  const select = (id: string): void => {
    setActive(id);
    onSelect?.(id);
    refs.current[id]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index === -1) {
      return;
    }
    if (event.key === 'ArrowRight') {
      const next = tabs[(index + 1) % tabs.length];
      if (next !== undefined) {
        select(next.id);
      }
    } else if (event.key === 'ArrowLeft') {
      const prev = tabs[(index - 1 + tabs.length) % tabs.length];
      if (prev !== undefined) {
        select(prev.id);
      }
    }
  };

  const current = tabs.find((tab) => tab.id === active);

  return (
    <div class="dwt-tabs">
      <div
        role="tablist"
        aria-label={ariaLabel ?? t('tabs.label')}
        class="dwt-tabs__list"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            class="dwt-tab"
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            onClick={() => {
              select(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current !== undefined && (
        <div
          role="tabpanel"
          id={`panel-${current.id}`}
          aria-labelledby={`tab-${current.id}`}
          class="dwt-tabpanel"
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
