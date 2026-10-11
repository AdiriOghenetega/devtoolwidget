import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { formatBytes, type NetworkEntry } from '../../core';
import { t } from '../i18n';
import { Button } from '../design-system/primitives/Button';
import { Dialog } from '../design-system/primitives/Dialog';
import { EmptyState } from '../design-system/primitives/EmptyState';
import { KeyValue } from '../design-system/primitives/KeyValue';
import { Select } from '../design-system/primitives/Select';
import { VirtualList } from '../design-system/primitives/VirtualList';
import { toCurl, toFetch } from './network-copy';

/** Props for {@link NetworkScreen}. */
export interface NetworkScreenProps {
  readonly entries: readonly NetworkEntry[];
  readonly onCopy?: (text: string) => void;
}

type GroupMode = 'none' | 'host' | 'type';

type Item =
  | { readonly kind: 'group'; readonly label: string }
  | { readonly kind: 'row'; readonly entry: NetworkEntry };

function hostOf(url: string): string {
  const scheme = url.indexOf('://');
  if (scheme === -1) {
    return url;
  }
  const start = scheme + 3;
  const slash = url.indexOf('/', start);
  return slash === -1 ? url.slice(start) : url.slice(start, slash);
}

function buildItems(entries: readonly NetworkEntry[], mode: GroupMode): Item[] {
  if (mode === 'none') {
    return entries.map((entry) => ({ kind: 'row' as const, entry }));
  }
  const groups = new Map<string, NetworkEntry[]>();
  for (const entry of entries) {
    const key = mode === 'host' ? hostOf(entry.url) : entry.resourceType;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  const items: Item[] = [];
  for (const [label, list] of groups) {
    items.push({ kind: 'group', label });
    for (const entry of list) {
      items.push({ kind: 'row', entry });
    }
  }
  return items;
}

/** Network screen (FR-4): virtualized table, mini waterfall, grouping and a detail drawer. */
export function NetworkScreen({ entries, onCopy }: NetworkScreenProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<GroupMode>('none');
  const [selected, setSelected] = useState<NetworkEntry | undefined>(undefined);
  const [copied, setCopied] = useState<string | undefined>(undefined);

  const filtered = entries.filter((entry) => search === '' || entry.url.includes(search));
  const items = buildItems(filtered, group);
  const maxTotal = Math.max(1, ...filtered.map((entry) => Number(entry.timing.total)));

  const copy = (text: string, label: string): void => {
    onCopy?.(text);
    setCopied(label);
  };

  if (entries.length === 0) {
    return <EmptyState description={t('network.empty')} />;
  }

  return (
    <section class="dwt-network" aria-label={t('network.title')}>
      <div class="dwt-network__toolbar">
        <input
          type="search"
          class="dwt-network__search"
          aria-label={t('network.search')}
          placeholder={t('network.search')}
          value={search}
          onInput={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <Select
          label={t('network.group.label')}
          value={group}
          options={[
            { value: 'none', label: t('network.group.none') },
            { value: 'host', label: t('network.group.host') },
            { value: 'type', label: t('network.group.type') },
          ]}
          onChange={(value) => {
            setGroup(value as GroupMode);
          }}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState description={t('network.empty')} />
      ) : (
        <VirtualList
          items={items}
          itemHeight={24}
          height={360}
          ariaLabel={t('network.title')}
          renderItem={(item) =>
            item.kind === 'group' ? (
              <strong class="dwt-network__group">{item.label}</strong>
            ) : (
              <button
                type="button"
                class="dwt-network__row"
                onClick={() => {
                  setSelected(item.entry);
                }}
              >
                <span class="dwt-network__method">{item.entry.method}</span>
                <span class="dwt-network__url">{item.entry.url}</span>
                <span class="dwt-network__status">{item.entry.status ?? '—'}</span>
                <span class="dwt-network__size">
                  {formatBytes(Number(item.entry.transferSize))}
                </span>
                <span
                  class="dwt-network__waterfall"
                  style={{
                    width: `${String((Number(item.entry.timing.total) / maxTotal) * 100)}%`,
                  }}
                />
              </button>
            )
          }
        />
      )}

      <Dialog
        open={selected !== undefined}
        title={t('network.detail')}
        onClose={() => {
          setSelected(undefined);
        }}
      >
        {selected !== undefined && (
          <div class="dwt-network__detail">
            <KeyValue
              items={[
                { key: 'URL', value: selected.url },
                { key: 'Status', value: String(selected.status ?? '—') },
                { key: 'Type', value: selected.resourceType },
                { key: 'Transfer', value: formatBytes(Number(selected.transferSize)) },
                { key: 'Total', value: `${String(Number(selected.timing.total))} ms` },
              ]}
            />
            <div class="dwt-network__copy">
              <Button
                onClick={() => {
                  copy(toCurl(selected), 'curl');
                }}
              >
                {t('network.copy.curl')}
              </Button>
              <Button
                onClick={() => {
                  copy(toFetch(selected), 'fetch');
                }}
              >
                {t('network.copy.fetch')}
              </Button>
              {copied !== undefined && <span role="status">{t('network.copied')}</span>}
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
