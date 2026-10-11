import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../testing/axe';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders a default title and optional description', () => {
    render(<EmptyState description="Reload the page to capture data" />);
    expect(screen.getByText('Nothing to show')).toBeTruthy();
    expect(screen.getByText('Reload the page to capture data')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
