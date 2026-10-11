import { describe, expect, it, vi } from 'vitest';
import { createFakeCommandsPort } from '../../platform/fakes';
import { createShortcutDispatcher } from './shortcut-dispatcher';

const chord = { key: 'e', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false };

function setup() {
  const commands = createFakeCommandsPort();
  const dispatch = vi.fn();
  const dispatcher = createShortcutDispatcher({ commands, dispatch });
  return { commands, dispatch, dispatcher };
}

describe('createShortcutDispatcher', () => {
  it('routes known manifest commands and ignores unknown ones', () => {
    const { commands, dispatch } = setup();
    commands.emit('hard-reload');
    commands.emit('not-a-command');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('hard-reload');
  });

  it('routes an in-page keydown only when not typing', () => {
    const { dispatch, dispatcher } = setup();

    expect(dispatcher.handleKey(chord, { tagName: 'DIV' })).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('toggle-panel');

    dispatch.mockClear();
    expect(dispatcher.handleKey(chord, { tagName: 'INPUT', type: 'text' })).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();

    expect(dispatcher.handleKey({ ...chord, key: 'z' }, { tagName: 'DIV' })).toBe(false);
  });

  it('stops routing after dispose', () => {
    const { commands, dispatch, dispatcher } = setup();
    dispatcher.dispose();
    commands.emit('hard-reload');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
