import { describe, expect, it } from 'vitest';
import { resolveShellMode } from './mode';
import { SHELL_CONTAINMENT_CSS } from './styles';

describe('resolveShellMode', () => {
  it('uses the side panel when available and falls back to the overlay', () => {
    expect(resolveShellMode({ available: true })).toBe('side-panel');
    expect(resolveShellMode({ available: false })).toBe('overlay');
  });
});

describe('SHELL_CONTAINMENT_CSS', () => {
  it('makes the host inert while keeping its parts interactive', () => {
    expect(SHELL_CONTAINMENT_CSS).toContain(':host { pointer-events: none; }');
    expect(SHELL_CONTAINMENT_CSS).toContain('pointer-events: auto;');
  });
});
