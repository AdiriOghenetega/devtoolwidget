import { describe, expect, it } from 'vitest';
import { toMillis, type ConsoleEntry, type NetworkEntry } from '../core';
import type { ClockPort } from '../platform/ports';
import { ConsoleCollector } from './console/console-collector';
import {
  NetworkCollector,
  type FetchLike,
  type FetchResponseLike,
} from './network/network-collector';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig123';

function clock(): ClockPort {
  return { now: () => toMillis(1_000), delay: () => Promise.resolve() };
}

const noopTarget = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

function fetchResponse(init: {
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): FetchResponseLike {
  return {
    url: init.url,
    status: 200,
    redirected: false,
    headers: {
      forEach(callback: (value: string, key: string) => void) {
        for (const [key, value] of Object.entries(init.headers ?? {})) {
          callback(value, key);
        }
      },
    },
    clone: () => ({ text: () => Promise.resolve(init.body ?? '') }),
  };
}

/** Runs one fetch through a collector and returns the emitted entry. */
async function captureFetch(
  response: FetchResponseLike,
  options: { readonly headers?: boolean; readonly body?: boolean } = {},
): Promise<NetworkEntry> {
  const entries: NetworkEntry[] = [];
  const target: { fetch?: FetchLike } = { fetch: () => Promise.resolve(response) };
  const collector = new NetworkCollector({
    target,
    clock: clock(),
    emit: (entry) => entries.push(entry),
    capture: {
      headers: options.headers ?? false,
      body: options.body ?? false,
      maxBodyBytes: 8_192,
    },
    createId: () => 'n1',
  });

  const patched = target.fetch;
  await patched?.(response.url);
  await Promise.resolve();
  collector.dispose();

  const entry = entries[0];
  if (entry === undefined) {
    throw new Error('no network entry captured');
  }
  return entry;
}

describe('default redaction at capture (PRD section 7 / G4)', () => {
  it('redacts sensitive query-string tokens in the emitted URL without opting in', async () => {
    const entry = await captureFetch(
      fetchResponse({ url: 'https://x.test/data?token=secret&q=ok' }),
    );

    expect(entry.url).toContain('token=REDACTED');
    expect(entry.url).toContain('q=ok');
    expect(JSON.stringify(entry)).not.toContain('secret');
  });

  it('redacts sensitive headers when header capture is enabled', async () => {
    const entry = await captureFetch(
      fetchResponse({
        url: 'https://x.test/data',
        headers: { Authorization: 'Bearer abc123', 'X-Plain': 'ok' },
      }),
      { headers: true },
    );

    expect(entry.headers?.Authorization).toBe('REDACTED');
    expect(entry.headers?.['X-Plain']).toBe('ok');
    expect(JSON.stringify(entry)).not.toContain('abc123');
  });

  it('redacts JWT-shaped strings in an opt-in body preview', async () => {
    const entry = await captureFetch(
      fetchResponse({ url: 'https://x.test/data', body: `payload=${JWT}` }),
      { body: true },
    );

    expect(entry.bodyPreview).toContain('REDACTED');
    expect(JSON.stringify(entry)).not.toContain(JWT);
  });

  it('redacts JWT-shaped strings in console arguments by default', () => {
    const entries: ConsoleEntry[] = [];
    const fakeConsole = { log: (...args: unknown[]) => args.length };
    const collector = new ConsoleCollector({
      console: fakeConsole,
      target: noopTarget,
      clock: clock(),
      emit: (entry) => entries.push(entry),
      createId: () => 'c1',
    });

    fakeConsole.log(`token ${JWT}`);
    collector.dispose();

    const serialized = JSON.stringify(entries[0]);
    expect(serialized).toContain('REDACTED');
    expect(serialized).not.toContain(JWT);
  });
});
