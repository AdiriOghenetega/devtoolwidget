import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { JSX } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { Shell, type LoadPanel } from './Shell';
import type { ShellPersistence } from './persistence';

function fakePersistence(options: { readonly disabled?: boolean } = {}): ShellPersistence {
  return {
    loadLauncher: () => Promise.resolve(undefined),
    saveLauncher: () => Promise.resolve(),
    isSiteDisabled: () => Promise.resolve(options.disabled ?? false),
    setSiteDisabled: () => Promise.resolve(),
  };
}

function panelModule(): { Panel: () => JSX.Element } {
  return { Panel: () => <div>PANEL</div> };
}

describe('Shell', () => {
  it('does not mount outside the top frame', () => {
    const { container } = render(
      <Shell
        origin="https://a.test"
        topFrame={false}
        score={90}
        errorCount={0}
        persistence={fakePersistence()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not mount when the site is disabled', async () => {
    render(
      <Shell
        origin="https://a.test"
        topFrame
        score={90}
        errorCount={0}
        persistence={fakePersistence({ disabled: true })}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /launcher/i })).toBeNull();
    });
  });

  it('lazy-loads the panel only on first open', async () => {
    const loadPanel = vi.fn<LoadPanel>(() => Promise.resolve(panelModule()));
    render(
      <Shell
        origin="https://a.test"
        topFrame
        score={90}
        errorCount={2}
        persistence={fakePersistence()}
        loadPanel={loadPanel}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launcher/i })).toBeTruthy();
    });
    expect(loadPanel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Health 90, 2 errors' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /launcher/i }));
    await waitFor(() => {
      expect(loadPanel).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('PANEL')).toBeTruthy();
  });

  it('delegates to the side panel and does not load the overlay panel', async () => {
    const open = vi.fn(() => Promise.resolve({ ok: true }));
    const loadPanel = vi.fn<LoadPanel>(() => Promise.resolve(panelModule()));
    render(
      <Shell
        origin="https://a.test"
        topFrame
        score={90}
        errorCount={0}
        persistence={fakePersistence()}
        sidePanel={{ available: true, open }}
        loadPanel={loadPanel}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launcher/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /launcher/i }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledTimes(1);
    });
    expect(loadPanel).not.toHaveBeenCalled();
  });
});
