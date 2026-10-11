import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { ShortcutCheatSheet } from './ShortcutCheatSheet';

describe('ShortcutCheatSheet', () => {
  it('lists every command with its binding', () => {
    render(<ShortcutCheatSheet />);
    expect(screen.getByText('Toggle devToolWidget panel')).toBeTruthy();
    expect(screen.getByText('Ctrl+Shift+E')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('shows a conflict message when two commands share a chord', () => {
    render(<ShortcutCheatSheet bindings={{ 'toggle-panel': 'Ctrl+K', 'hard-reload': 'ctrl+k' }} />);
    expect(screen.getByRole('status').textContent).toContain('Ctrl+K');
  });
});
