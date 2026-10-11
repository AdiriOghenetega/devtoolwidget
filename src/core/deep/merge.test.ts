import { describe, expect, it } from 'vitest';
import { toBytes, toMillis } from '../domain/brands';
import type { NetworkEntry } from '../domain/network';
import { mergeNetworkEntry, type DeepNetworkData } from './merge';

const zero = toMillis(0);
const soft: NetworkEntry = {
  id: 's1',
  method: 'GET',
  url: 'https://a.test/x',
  status: 200,
  resourceType: 'script',
  transferSize: toBytes(10),
  decodedSize: toBytes(20),
  fromCache: false,
  timing: { dns: zero, connect: zero, tls: zero, ttfb: zero, download: zero, total: toMillis(5) },
};
const deep: DeepNetworkData = {
  requestId: 'd1',
  url: 'https://a.test/x?v=2',
  method: 'POST',
  status: 201,
  requestHeaders: { 'x-req': '1' },
  responseHeaders: { 'content-type': 'application/json' },
  bodyPreview: '{"ok":true}',
  timing: { dns: zero, connect: zero, tls: zero, ttfb: zero, download: zero, total: toMillis(7) },
  encodedSize: 42,
};

describe('mergeNetworkEntry', () => {
  it('returns nothing when neither source has the request', () => {
    expect(mergeNetworkEntry(undefined, undefined)).toBeUndefined();
  });

  it('returns the soft entry unchanged when there is no deep data', () => {
    const merged = mergeNetworkEntry(soft, undefined);
    expect(merged?.source).toBe('soft');
    expect(merged?.entry).toBe(soft);
  });

  it('builds a deep-only entry', () => {
    const merged = mergeNetworkEntry(undefined, deep);
    expect(merged?.source).toBe('deep');
    expect(merged?.entry.url).toBe(deep.url);
    expect(merged?.entry.status).toBe(201);
    expect(Number(merged?.entry.transferSize)).toBe(42);
  });

  it('lets deep data win and lets soft fill the gaps', () => {
    const merged = mergeNetworkEntry(soft, deep);
    expect(merged?.source).toBe('merged');
    expect(merged?.entry.method).toBe('POST');
    expect(merged?.entry.url).toBe(deep.url);
    expect(merged?.entry.status).toBe(201);
    expect(Number(merged?.entry.timing.total)).toBe(7);
    expect(merged?.entry.bodyPreview).toBe('{"ok":true}');
    expect(merged?.entry.headers).toMatchObject({ 'content-type': 'application/json' });
    // Filled from soft:
    expect(merged?.entry.resourceType).toBe('script');
    expect(merged?.entry.fromCache).toBe(false);
  });
});
