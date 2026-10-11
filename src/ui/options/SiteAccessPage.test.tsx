import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { SiteAccessPage, type AllowResult, type SiteAccessPorts } from './SiteAccessPage';

interface FakeState {
  granted: Set<string>;
  current: string | undefined;
  allowResult: AllowResult;
}

function createFakePorts(
  initial: {
    granted?: readonly string[];
    current?: string | undefined;
    allowResult?: AllowResult;
  } = {},
): {
  ports: SiteAccessPorts;
  state: FakeState;
} {
  const state: FakeState = {
    granted: new Set(initial.granted ?? []),
    current: initial.current,
    allowResult: initial.allowResult ?? 'granted',
  };
  return {
    state,
    ports: {
      listGranted: () => Promise.resolve([...state.granted]),
      currentOrigin: () => Promise.resolve(state.current),
      allow: (origin) => {
        if (state.allowResult === 'granted') {
          state.granted.add(origin);
        }
        return Promise.resolve(state.allowResult);
      },
      revoke: (origin) => {
        state.granted.delete(origin);
        return Promise.resolve();
      },
    },
  };
}

describe('SiteAccessPage', () => {
  it('starts with no sites allowed (new installs run on no sites)', async () => {
    const { ports } = createFakePorts();
    render(<SiteAccessPage ports={ports} />);
    await waitFor(() => {
      expect(screen.getByText('No sites allowed yet.')).toBeTruthy();
    });
  });

  it('allows the current site and lists it', async () => {
    const { ports, state } = createFakePorts({ current: 'http://localhost' });
    render(<SiteAccessPage ports={ports} />);

    const allow = await screen.findByRole('button', { name: 'Allow on http://localhost' });
    fireEvent.click(allow);

    await waitFor(() => {
      expect(state.granted.has('http://localhost')).toBe(true);
    });
    expect(await screen.findByText('http://localhost')).toBeTruthy();
  });

  it('explains that a grant covers the whole host on any port', async () => {
    const { ports } = createFakePorts();
    render(<SiteAccessPage ports={ports} />);
    await waitFor(() => {
      expect(screen.getByText(/whole site on every port/i)).toBeTruthy();
    });
  });

  it('removes a granted site', async () => {
    const { ports, state } = createFakePorts({
      granted: ['https://example.com'],
      current: 'https://example.com',
    });
    render(<SiteAccessPage ports={ports} />);

    const remove = await screen.findByRole('button', { name: 'Remove https://example.com' });
    fireEvent.click(remove);

    await waitFor(() => {
      expect(state.granted.size).toBe(0);
    });
    expect(await screen.findByText('No sites allowed yet.')).toBeTruthy();
  });

  it('reports a denied request without adding the site', async () => {
    const { ports, state } = createFakePorts({
      current: 'https://denied.test',
      allowResult: 'denied',
    });
    render(<SiteAccessPage ports={ports} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Allow on https://denied.test' }));

    expect(await screen.findByText('Access was not granted.')).toBeTruthy();
    expect(state.granted.size).toBe(0);
  });

  it('asks the user to open a website tab when the current tab has no origin', async () => {
    const { ports } = createFakePorts({ current: undefined });
    render(<SiteAccessPage ports={ports} />);
    await waitFor(() => {
      expect(screen.getByText('Open a website tab to allow it here.')).toBeTruthy();
    });
  });
});
