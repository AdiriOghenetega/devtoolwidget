import { describe, expect, it } from 'vitest';
import { toBytes, toMillis, type NetworkEntry } from '../../core';
import { toCurl, toFetch } from './network-copy';

const entry: NetworkEntry = {
  id: 'n1',
  method: 'POST',
  url: 'https://api.test/x',
  status: 200,
  resourceType: 'fetch',
  transferSize: toBytes(10),
  decodedSize: toBytes(20),
  fromCache: false,
  timing: {
    dns: toMillis(0),
    connect: toMillis(0),
    tls: toMillis(0),
    ttfb: toMillis(1),
    download: toMillis(1),
    total: toMillis(2),
  },
  headers: { 'content-type': 'application/json' },
};

describe('network copy helpers', () => {
  it('builds a cURL command with method, URL and headers', () => {
    const curl = toCurl(entry);
    expect(curl).toContain('curl -X POST');
    expect(curl).toContain("'https://api.test/x'");
    expect(curl).toContain("'content-type: application/json'");
  });

  it('builds a fetch snippet with method and headers', () => {
    const snippet = toFetch(entry);
    expect(snippet).toBe(
      'fetch("https://api.test/x", { method: "POST", headers: {"content-type":"application/json"} })',
    );
  });

  it('omits headers when none are captured', () => {
    const bare: NetworkEntry = {
      id: 'n2',
      method: 'POST',
      url: 'https://api.test/x',
      status: 200,
      resourceType: 'fetch',
      transferSize: toBytes(10),
      decodedSize: toBytes(20),
      fromCache: false,
      timing: {
        dns: toMillis(0),
        connect: toMillis(0),
        tls: toMillis(0),
        ttfb: toMillis(1),
        download: toMillis(1),
        total: toMillis(2),
      },
    };
    expect(toCurl(bare)).toBe("curl -X POST 'https://api.test/x'");
    expect(toFetch(bare)).toBe('fetch("https://api.test/x", { method: "POST" })');
  });
});
