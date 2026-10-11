import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { FirstRunTour } from './FirstRunTour';

describe('FirstRunTour', () => {
  it('shows the welcome step first', () => {
    render(<FirstRunTour onFinish={() => undefined} />);
    expect(screen.getByText(/summarises what is wrong/)).toBeTruthy();
  });

  it('explains each permission in plain language and can go back', () => {
    render(<FirstRunTour onFinish={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/storage - keeps your preferences/)).toBeTruthy();
    expect(screen.getByText(/tabs - reads the current tab URL/)).toBeTruthy();
    expect(screen.getByText(/scripting - injects the widget/)).toBeTruthy();
    expect(screen.getByText(/browsingData - clears cookies/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(/summarises what is wrong/)).toBeTruthy();
  });

  it('shows the data-handling statement and finishes', () => {
    const onFinish = vi.fn();
    render(<FirstRunTour onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/everything stays on your device/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
