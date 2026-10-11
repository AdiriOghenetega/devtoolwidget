import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'a', label: 'Network', panel: 'Network panel' },
  { id: 'b', label: 'Console', panel: 'Console panel' },
];

describe('Tabs', () => {
  it('selects a tab on click and shows its panel', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Network' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Console' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('Console panel');
  });

  it('moves selection with arrow keys', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Console' }).getAttribute('aria-selected')).toBe('true');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Tabs tabs={tabs} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
