import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ConsoleEntry, ConsoleLevel } from '../../core';
import { t } from '../i18n';
import { Badge, type BadgeSeverity } from '../design-system/primitives/Badge';
import { EmptyState } from '../design-system/primitives/EmptyState';
import { Select } from '../design-system/primitives/Select';
import { Switch } from '../design-system/primitives/Switch';
import { VirtualList } from '../design-system/primitives/VirtualList';

/** Props for {@link ConsoleScreen}. */
export interface ConsoleScreenProps {
  readonly entries: readonly ConsoleEntry[];
  readonly preserveLog?: boolean;
  readonly onPreserveLogChange?: (preserveLog: boolean) => void;
}

const LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug', 'trace'];

function severityOf(level: ConsoleLevel): BadgeSeverity {
  if (level === 'error') {
    return 'critical';
  }
  return level === 'warn' ? 'warning' : 'info';
}

function textOf(entry: ConsoleEntry): string {
  const first = entry.args[0];
  if (first?.type === 'string') {
    return first.value;
  }
  return entry.args.map((arg) => arg.type).join(', ');
}

interface Row {
  readonly entry: ConsoleEntry;
  readonly count: number;
}

function groupBySignature(entries: readonly ConsoleEntry[]): Row[] {
  const groups = new Map<string, Row>();
  for (const entry of entries) {
    const key = `${entry.kind}/${entry.level}/${textOf(entry)}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { entry, count: entry.count });
    } else {
      groups.set(key, { entry: existing.entry, count: existing.count + entry.count });
    }
  }
  return [...groups.values()];
}

/** Console screen (FR-3): level filter, search, collapsed counts and preserve-log. */
export function ConsoleScreen({
  entries,
  preserveLog = false,
  onPreserveLogChange,
}: ConsoleScreenProps): JSX.Element {
  const [level, setLevel] = useState<ConsoleLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [collapse, setCollapse] = useState(false);

  const filtered = entries.filter((entry) => {
    if (level !== 'all' && entry.level !== level) {
      return false;
    }
    return search === '' || textOf(entry).includes(search);
  });
  const rows: Row[] = collapse
    ? groupBySignature(filtered)
    : filtered.map((entry) => ({ entry, count: entry.count }));

  return (
    <section class="dwt-console" aria-label={t('console.title')}>
      <div class="dwt-console__toolbar">
        <Select
          label={t('console.filter.level')}
          value={level}
          options={[
            { value: 'all', label: t('console.level.all') },
            ...LEVELS.map((candidate) => ({ value: candidate, label: candidate })),
          ]}
          onChange={(value) => {
            setLevel(value as ConsoleLevel | 'all');
          }}
        />
        <input
          type="search"
          class="dwt-console__search"
          aria-label={t('console.search')}
          placeholder={t('console.search')}
          value={search}
          onInput={(event) => {
            setSearch(event.currentTarget.value);
          }}
        />
        <Switch
          label={t('console.preserveLog')}
          checked={preserveLog}
          {...(onPreserveLogChange === undefined ? {} : { onChange: onPreserveLogChange })}
        />
        <Switch label={t('console.collapse')} checked={collapse} onChange={setCollapse} />
      </div>
      {rows.length === 0 ? (
        <EmptyState description={t('console.empty')} />
      ) : (
        <VirtualList
          items={rows}
          itemHeight={24}
          height={360}
          ariaLabel={t('console.title')}
          renderItem={(row) => (
            <div class="dwt-console__row" data-level={row.entry.level}>
              <Badge severity={severityOf(row.entry.level)}>{row.entry.level}</Badge>
              <span class="dwt-console__text">{textOf(row.entry)}</span>
              {row.count > 1 && (
                <span class="dwt-console__count">{t('console.count', { count: row.count })}</span>
              )}
            </div>
          )}
        />
      )}
    </section>
  );
}
