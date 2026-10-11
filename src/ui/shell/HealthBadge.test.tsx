import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { HealthBadge } from './HealthBadge';

describe('HealthBadge', () => {
  it('announces the health score and error count and opens on click', () => {
    const onClick = vi.fn();
    render(<HealthBadge score={82} errorCount={3} onClick={onClick} />);
    const badge = screen.getByRole('button', { name: 'Health 82, 3 errors' });
    fireEvent.click(badge);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
