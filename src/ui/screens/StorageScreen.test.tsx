import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { toBytes, type ClearReport, type ClearRequest } from '../../core';
import { StorageScreen } from './StorageScreen';

const summary = {
  areas: [{ area: 'localStorage' as const, count: 3, approximateSize: toBytes(2_048) }],
};

const report: ClearReport = {
  ok: false,
  bytesFreed: 2_048,
  warnings: [],
  results: [
    { stepId: 'page:localStorage', ok: true, skipped: false, bytesFreed: 2_048 },
    {
      stepId: 'background:cookies:http-only',
      ok: false,
      skipped: false,
      bytesFreed: 0,
      reason: 'denied',
    },
  ],
  failures: [
    {
      stepId: 'background:cookies:http-only',
      ok: false,
      skipped: false,
      bytesFreed: 0,
      reason: 'denied',
    },
  ],
};

describe('StorageScreen', () => {
  it('shows an empty state when there is no storage', () => {
    render(<StorageScreen summary={{ areas: [] }} onClear={() => undefined} />);
    expect(screen.getByText('No storage data')).toBeTruthy();
  });

  it('lists areas with sizes', () => {
    render(<StorageScreen summary={summary} onClear={() => undefined} />);
    expect(screen.getByText('localStorage')).toBeTruthy();
    expect(screen.getByText(/3 ·/)).toBeTruthy();
  });

  it('edits the keep list', () => {
    render(<StorageScreen summary={summary} onClear={() => undefined} />);
    fireEvent.input(screen.getByLabelText('Keep list'), { target: { value: 'token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('token')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('token')).toBeNull();
  });

  it('confirms before clearing and passes the request with the keep list', () => {
    const onClear = vi.fn<(request: ClearRequest) => void>();
    render(<StorageScreen summary={summary} onClear={onClear} />);

    fireEvent.input(screen.getByLabelText('Keep list'), { target: { value: 'token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClear.mock.calls[0]?.[0]).toMatchObject({ keep: ['token'], scope: 'origin' });
    expect(onClear.mock.calls[0]?.[0].types).toContain('cookies');
  });

  it('renders the clear report', () => {
    render(<StorageScreen summary={summary} report={report} onClear={() => undefined} />);
    expect(screen.getByText('Clear report')).toBeTruthy();
    expect(screen.getByText(/1 of 2 steps succeeded/)).toBeTruthy();
    expect(screen.getByText(/Failed/)).toBeTruthy();
  });
});
