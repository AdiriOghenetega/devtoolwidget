import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders the severity label', () => {
    render(<Badge severity="critical" />);
    expect(screen.getByText('Critical')).toBeTruthy();
  });

  it('accepts custom content', () => {
    render(<Badge severity="warning">3 warnings</Badge>);
    expect(screen.getByText('3 warnings')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Badge severity="info" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
