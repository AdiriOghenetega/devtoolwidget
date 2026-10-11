import { describe, expect, it, vi } from 'vitest';
import { createLauncher } from './launcher';

const viewport = { width: 200, height: 200 };

function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
}

describe('createLauncher', () => {
  it('renders a .dwt-launcher button with an accessible label', () => {
    const launcher = createLauncher({
      doc: document,
      viewport: () => viewport,
      placement: { edge: 'right', offset: 0.5 },
      onOpen: () => undefined,
      onPlacementChange: () => undefined,
    });

    expect(launcher.element.className).toBe('dwt-launcher');
    expect(launcher.element.getAttribute('aria-label')).toBe('devToolWidget launcher');
    // Right edge, vertically centred: x = 200 - 44 - 8, y = 8 + 0.5 * (200 - 44 - 16).
    expect(launcher.element.style.left).toBe('148px');
    expect(launcher.element.style.top).toBe('78px');
  });

  it('opens on click when the pointer did not drag', () => {
    const onOpen = vi.fn();
    const launcher = createLauncher({
      doc: document,
      viewport: () => viewport,
      placement: { edge: 'right', offset: 0.5 },
      onOpen,
      onPlacementChange: () => undefined,
    });

    launcher.element.dispatchEvent(mouse('mousedown', 180, 100));
    launcher.element.dispatchEvent(mouse('mouseup', 180, 100));
    launcher.element.dispatchEvent(mouse('click', 180, 100));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('snaps to the nearest edge and persists on drag release, not opening', () => {
    const onOpen = vi.fn();
    const onPlacementChange = vi.fn();
    const launcher = createLauncher({
      doc: document,
      viewport: () => viewport,
      placement: { edge: 'right', offset: 0.5 },
      onOpen,
      onPlacementChange,
    });

    launcher.element.dispatchEvent(mouse('mousedown', 180, 100));
    document.dispatchEvent(mouse('mousemove', 20, 100));
    document.dispatchEvent(mouse('mouseup', 20, 100));

    expect(onPlacementChange).toHaveBeenCalledTimes(1);
    expect(onPlacementChange.mock.calls[0]?.[0]).toMatchObject({ edge: 'left' });

    launcher.element.dispatchEvent(mouse('click', 20, 100));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('dispose removes the element and stops listening', () => {
    const onPlacementChange = vi.fn();
    const launcher = createLauncher({
      doc: document,
      viewport: () => viewport,
      placement: { edge: 'right', offset: 0.5 },
      onOpen: () => undefined,
      onPlacementChange,
    });
    document.documentElement.append(launcher.element);

    launcher.element.dispatchEvent(mouse('mousedown', 180, 100));
    launcher.dispose();
    document.dispatchEvent(mouse('mousemove', 20, 100));
    document.dispatchEvent(mouse('mouseup', 20, 100));

    expect(document.querySelector('.dwt-launcher')).toBeNull();
    expect(onPlacementChange).not.toHaveBeenCalled();
  });
});
