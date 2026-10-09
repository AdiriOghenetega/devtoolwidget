import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { HealthBadge } from './index';

describe('HealthBadge', () => {
  it('renders the health score', () => {
    render(<HealthBadge score={90} />);
    expect(screen.getByText('Health 90').textContent).toBe('Health 90');
  });
});
