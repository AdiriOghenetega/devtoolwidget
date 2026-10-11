/** The manifest commands the extension exposes (PRD FR-13). */
export type CommandId = 'toggle-panel' | 'clear-site-data' | 'hard-reload';

/** A command and its default binding. */
export interface CommandDefinition {
  readonly id: CommandId;
  readonly title: string;
  readonly description: string;
  /** Default chord, or `null` when unbound by default. */
  readonly defaultBinding: string | null;
}

/** The built-in commands and their default chords. */
export const COMMAND_DEFINITIONS: readonly CommandDefinition[] = [
  {
    id: 'toggle-panel',
    title: 'Toggle devToolWidget panel',
    description: 'Show or hide the panel on the current tab.',
    defaultBinding: 'Ctrl+Shift+E',
  },
  {
    id: 'clear-site-data',
    title: 'Clear site data',
    description: 'Clear cookies and storage for the current origin.',
    defaultBinding: null,
  },
  {
    id: 'hard-reload',
    title: 'Hard reload',
    description: 'Reload the current tab bypassing the HTTP cache.',
    defaultBinding: 'Ctrl+Shift+R',
  },
];

/** A user-configurable binding map (command id → chord, or null to unbind). */
export type BindingMap = Readonly<Partial<Record<CommandId, string | null>>>;

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

/**
 * Normalizes a chord to `Modifier+...+Key` with a stable modifier order and an
 * uppercased key, so `shift+ctrl+e` and `Ctrl+Shift+E` compare equal.
 */
export function normalizeChord(chord: string): string {
  const parts = chord.split('+').map((part) => part.trim());
  const key = (parts.pop() ?? '').toUpperCase();
  const modifiers = new Set(
    parts.map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') {
        return 'Ctrl';
      }
      if (lower === 'cmd' || lower === 'meta' || lower === 'command') {
        return 'Meta';
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }),
  );
  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...ordered, key].filter((part) => part !== '').join('+');
}

/** Resolves defaults plus user overrides into a full binding map. */
export function resolveBindings(
  custom: Readonly<Record<string, string | null>>,
): Record<CommandId, string | null> {
  const resolved = {} as Record<CommandId, string | null>;
  for (const definition of COMMAND_DEFINITIONS) {
    const override = custom[definition.id];
    resolved[definition.id] =
      override === undefined
        ? definition.defaultBinding === null
          ? null
          : normalizeChord(definition.defaultBinding)
        : override === null
          ? null
          : normalizeChord(override);
  }
  return resolved;
}

/** Two commands bound to the same chord. */
export interface ShortcutConflict {
  readonly chord: string;
  readonly commands: readonly CommandId[];
}

/** Finds chords bound to more than one command (for the conflict message). */
export function findConflicts(bindings: BindingMap): readonly ShortcutConflict[] {
  const byChord = new Map<string, CommandId[]>();
  for (const definition of COMMAND_DEFINITIONS) {
    const binding = bindings[definition.id];
    if (binding === undefined || binding === null) {
      continue;
    }
    const chord = normalizeChord(binding);
    const list = byChord.get(chord) ?? [];
    list.push(definition.id);
    byChord.set(chord, list);
  }
  const conflicts: ShortcutConflict[] = [];
  for (const [chord, commands] of byChord) {
    if (commands.length > 1) {
      conflicts.push({ chord, commands });
    }
  }
  return conflicts;
}

/** The subset of a KeyboardEvent the shortcut logic needs. */
export interface KeyboardContext {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}

/** The subset of an Element needed to decide whether it is a text field. */
export interface TargetLike {
  readonly tagName?: string;
  readonly type?: string;
  readonly isContentEditable?: boolean;
}

/** True when the focused element is an input the user is typing into. */
export function isEditableTarget(target: TargetLike | null | undefined): boolean {
  if (target === null || target === undefined) {
    return false;
  }
  if (target.isContentEditable === true) {
    return true;
  }
  const tag = (target.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag !== 'INPUT') {
    return false;
  }
  const type = (target.type ?? 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file'].includes(type);
}

/** Builds a normalized chord from a keyboard event. */
export function chordFromEvent(event: KeyboardContext): string {
  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.metaKey) {
    parts.push('Meta');
  }
  const key = event.key === ' ' ? 'Space' : event.key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

/**
 * Resolves the command a keydown should trigger, or `undefined`. Focus-safe:
 * when the user is typing in an editable field, no shortcut fires.
 */
export function shouldHandleShortcut(
  event: KeyboardContext,
  target: TargetLike | null | undefined,
  bindings: BindingMap,
): CommandId | undefined {
  if (isEditableTarget(target)) {
    return undefined;
  }
  const chord = chordFromEvent(event);
  for (const definition of COMMAND_DEFINITIONS) {
    const binding = bindings[definition.id];
    if (binding !== undefined && binding !== null && normalizeChord(binding) === chord) {
      return definition.id;
    }
  }
  return undefined;
}

/** One row of the in-panel cheat sheet. */
export interface CheatSheetEntry {
  readonly id: CommandId;
  readonly title: string;
  readonly binding: string | null;
}

/** Builds the cheat sheet rows from the resolved bindings. */
export function cheatSheet(bindings: BindingMap): readonly CheatSheetEntry[] {
  return COMMAND_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    binding: bindings[definition.id] ?? null,
  }));
}
