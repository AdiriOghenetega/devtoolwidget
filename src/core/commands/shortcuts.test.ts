import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  chordFromEvent,
  cheatSheet,
  findConflicts,
  isEditableTarget,
  normalizeChord,
  resolveBindings,
  shouldHandleShortcut,
} from './shortcuts';

describe('normalizeChord', () => {
  it('is case-insensitive and order-stable', () => {
    expect(normalizeChord('shift+ctrl+e')).toBe('Ctrl+Shift+E');
    expect(normalizeChord('Ctrl+Shift+E')).toBe('Ctrl+Shift+E');
    expect(normalizeChord('meta+k')).toBe('Meta+K');
  });

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(fc.string(), (chord) => {
        const once = normalizeChord(chord);
        expect(normalizeChord(once)).toBe(once);
      }),
    );
  });
});

describe('resolveBindings', () => {
  it('uses defaults and applies overrides', () => {
    const resolved = resolveBindings({
      'hard-reload': 'Ctrl+Alt+R',
      'clear-site-data': 'Ctrl+Shift+C',
    });
    expect(resolved['toggle-panel']).toBe('Ctrl+Shift+E');
    expect(resolved['hard-reload']).toBe('Ctrl+Alt+R');
    expect(resolved['clear-site-data']).toBe('Ctrl+Shift+C');
  });

  it('keeps unbound commands null', () => {
    expect(resolveBindings({})['clear-site-data']).toBeNull();
    expect(resolveBindings({ 'toggle-panel': null })['toggle-panel']).toBeNull();
  });
});

describe('findConflicts', () => {
  it('reports a chord bound to more than one command', () => {
    const conflicts = findConflicts({ 'toggle-panel': 'Ctrl+K', 'hard-reload': 'ctrl+k' });
    expect(conflicts).toEqual([{ chord: 'Ctrl+K', commands: ['toggle-panel', 'hard-reload'] }]);
  });

  it('reports nothing for distinct bindings', () => {
    expect(findConflicts({ 'toggle-panel': 'Ctrl+K', 'hard-reload': 'Ctrl+L' })).toEqual([]);
  });

  it('finds a conflict exactly when two chords normalize equal (property)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
        const conflicts = findConflicts({ 'toggle-panel': a, 'hard-reload': b });
        const same = normalizeChord(a) === normalizeChord(b) && normalizeChord(a) !== '';
        expect(conflicts.length > 0).toBe(same);
      }),
    );
  });
});

describe('isEditableTarget', () => {
  it('treats text inputs and content-editable elements as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget({ isContentEditable: true })).toBe(true);
  });

  it('treats buttons and plain elements as not editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT', type: 'button' })).toBe(false);
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('chordFromEvent / shouldHandleShortcut', () => {
  const event = { key: 'e', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false };

  it('builds a chord from a keyboard event', () => {
    expect(chordFromEvent(event)).toBe('Ctrl+Shift+E');
    expect(
      chordFromEvent({ key: ' ', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }),
    ).toBe('Ctrl+Space');
  });

  it('resolves a bound command and ignores edits and unbound chords', () => {
    const bindings = resolveBindings({});
    expect(shouldHandleShortcut(event, { tagName: 'DIV' }, bindings)).toBe('toggle-panel');
    expect(
      shouldHandleShortcut(event, { tagName: 'INPUT', type: 'text' }, bindings),
    ).toBeUndefined();
    expect(
      shouldHandleShortcut({ ...event, key: 'z' }, { tagName: 'DIV' }, bindings),
    ).toBeUndefined();
  });
});

describe('cheatSheet', () => {
  it('lists every command with its binding', () => {
    const sheet = cheatSheet(resolveBindings({}));
    expect(sheet).toHaveLength(3);
    expect(sheet.find((entry) => entry.id === 'clear-site-data')?.binding).toBeNull();
  });
});
