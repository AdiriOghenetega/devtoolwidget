import type { JSX } from 'preact';
import { cheatSheet, findConflicts, resolveBindings, type BindingMap } from '../../core';
import { t } from '../i18n';

/** Props for {@link ShortcutCheatSheet}. */
export interface ShortcutCheatSheetProps {
  readonly bindings?: BindingMap;
}

/**
 * The in-panel shortcut cheat sheet (PRD FR-13): every command and its binding,
 * plus a conflict message when two commands share a chord.
 */
export function ShortcutCheatSheet({ bindings }: ShortcutCheatSheetProps): JSX.Element {
  const resolved = resolveBindings(bindings ?? {});
  const conflicts = findConflicts(resolved);
  const entries = cheatSheet(resolved);

  return (
    <section class="dwt-sheet" aria-label={t('sheet.title')}>
      <h2>{t('sheet.title')}</h2>

      {conflicts.map((conflict) => (
        <p key={conflict.chord} role="status" class="dwt-sheet__conflict">
          {t('sheet.conflict', { chord: conflict.chord })}
        </p>
      ))}

      <ul class="dwt-sheet__list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span class="dwt-sheet__command">{entry.title}</span>
            <kbd class="dwt-sheet__binding">{entry.binding ?? t('sheet.unbound')}</kbd>
          </li>
        ))}
      </ul>
    </section>
  );
}
