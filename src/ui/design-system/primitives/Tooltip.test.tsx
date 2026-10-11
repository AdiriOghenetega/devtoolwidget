import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows on hover and hides on leave', () => {
    render(
      <Tooltip label="Save your settings">
        <Button>Save</Button>
      </Tooltip>,
    );
    const wrapper = screen.getByText('Save').closest('.dwt-tooltip-wrapper');
    expect(wrapper).not.toBeNull();
    if (wrapper === null) {
      return;
    }
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip', { hidden: true }).hasAttribute('hidden')).toBe(false);
    fireEvent.mouseLeave(wrapper);
    expect(screen.getByRole('tooltip', { hidden: true }).hasAttribute('hidden')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Tooltip label="Save your settings">
        <Button>Save</Button>
      </Tooltip>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
