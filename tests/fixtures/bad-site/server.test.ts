import { get } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { BIG_PAYLOAD_BYTES, HUGE_PNG_BYTES, SLOW_DELAY_MS } from './pages.ts';
import { resolveRoute, startServer, type RunningServer } from './server.ts';

function bodyOf(pathname: string): string {
  const body = resolveRoute(pathname).body;
  return typeof body === 'string' ? body : '';
}

/** One real loopback request; `node:http` avoids the happy-dom fetch CORS layer. */
function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body });
      });
    });
    request.on('error', reject);
  });
}

describe('resolveRoute', () => {
  it('serves the index page as HTML at the root', () => {
    const route = resolveRoute('/');
    expect(route.status).toBe(200);
    expect(route.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(route.body).toContain('<h1>Staging environment</h1>');
  });

  it('marks the cacheable app script with a max-age cache-control header', () => {
    expect(resolveRoute('/app.js').headers['cache-control']).toBe('public, max-age=3600');
  });

  it('omits cache headers for the nocache script so the missing-cache rule can fire', () => {
    expect(resolveRoute('/nocache.js').headers['cache-control']).toBeUndefined();
    expect(resolveRoute('/nocache.js').status).toBe(200);
  });

  it('serves byte-identical bodies from /app.js and /duplicate', () => {
    expect(bodyOf('/duplicate')).toBe(bodyOf('/app.js'));
  });

  it('serves the hostile spy page with a capturing message listener', () => {
    const route = resolveRoute('/spy');
    expect(route.status).toBe(200);
    expect(route.body).toContain('__dtwSpy');
    expect(route.body).toContain('devtoolwidget:bridge');
  });

  it('delays the slow endpoint by the configured amount', () => {
    expect(resolveRoute('/slow').delayMs).toBe(SLOW_DELAY_MS);
  });

  it('serves the big payload uncompressed and at its declared size', () => {
    const route = resolveRoute('/big');
    expect(route.headers['content-encoding']).toBeUndefined();
    expect(bodyOf('/big')).toHaveLength(BIG_PAYLOAD_BYTES);
  });

  it('serves the large image as a PNG', () => {
    const route = resolveRoute('/huge.png');
    expect(route.headers['content-type']).toBe('image/png');
    expect(route.body).toBeInstanceOf(Uint8Array);
    expect(route.body).toHaveLength(HUGE_PNG_BYTES);
  });

  it('returns the requested failing status codes', () => {
    expect(resolveRoute('/status/404').status).toBe(404);
    expect(resolveRoute('/status/500').status).toBe(500);
  });

  it('returns a not-found response for unknown paths', () => {
    expect(resolveRoute('/definitely-missing').status).toBe(404);
  });
});

describe('startServer', () => {
  let running: RunningServer | undefined;

  afterAll(async () => {
    await running?.close();
  });

  it('answers a live request on an ephemeral port', async () => {
    running = await startServer(0);
    expect(running.port).toBeGreaterThan(0);

    const response = await httpGet(`${running.origin}/ok`);
    expect(response.status).toBe(200);
    expect(response.body).toBe('{"ok":true}');
  });
});
