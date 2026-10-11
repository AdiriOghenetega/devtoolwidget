import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders a modal dialog and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Confirm" onClose={onClose}>
        Body
      </Dialog>,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => undefined}>
        Body
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Dialog open title="Confirm" onClose={() => undefined}>
        Body
      </Dialog>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
