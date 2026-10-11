import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Panel } from './Panel';

const size = { width: 360, height: 560 };

describe('Panel', () => {
  it('exposes docking controls and reports mode changes', () => {
    const onModeChange = vi.fn();
    render(<Panel mode="right" size={size} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dock bottom' }));
    expect(onModeChange).toHaveBeenCalledWith('bottom');
  });

  it('moves focus into the panel and restores it when the restore target changes', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);
    const firstSpy = vi.spyOn(first, 'focus');

    const { rerender } = render(<Panel mode="floating" size={size} restoreFocusTo={first} />);
    expect(document.activeElement).toBe(screen.getByRole('complementary'));

    rerender(<Panel mode="floating" size={size} restoreFocusTo={second} />);
    expect(firstSpy).toHaveBeenCalledTimes(1);
  });

  it('closes and resizes', () => {
    const onClose = vi.fn();
    const onResize = vi.fn();
    const { container } = render(
      <Panel mode="right" size={size} onClose={onClose} onResize={onResize} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const handle = container.querySelector('.dwt-panel__resize');
    expect(handle).not.toBeNull();
    if (handle !== null) {
      fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
      fireEvent.mouseMove(document, { clientX: 40, clientY: 0 });
      fireEvent.mouseUp(document);
    }
    expect(onResize).toHaveBeenCalled();
  });
});
