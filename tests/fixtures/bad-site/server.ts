/**
 * Deterministic HTTP fixture that reproduces the page defects the extension is
 * meant to diagnose. Used by the Playwright suite (`tests/e2e`) as the target
 * site and unit-tested directly in `server.test.ts`.
 *
 * Run standalone with `node tests/fixtures/bad-site/server.ts` (Node >= 24
 * strips the TypeScript types natively). The port defaults to 4178 and can be
 * overridden with `BAD_SITE_PORT`.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  APP_JS,
  BLOCKING_JS,
  INDEX_HTML,
  NOCACHE_JS,
  SERVICE_WORKER_JS,
  SLOW_DELAY_MS,
  SPY_HTML,
  bigPayload,
  hugePng,
} from './pages.ts';

/** Default port the fixture listens on when not overridden by the environment. */
export const DEFAULT_PORT = 4178;

/** Host the fixture binds to; loopback only, never exposed. */
export const DEFAULT_HOST = '127.0.0.1';

/** A fully resolved response for one route. */
export interface RouteResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | Uint8Array;
  /** Artificial latency applied before responding, in milliseconds. */
  readonly delayMs: number;
}

/** A started fixture server and how to talk to it. */
export interface RunningServer {
  readonly server: Server;
  readonly origin: string;
  readonly port: number;
  close(): Promise<void>;
}

const HTML = 'text/html; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';
const JSON = 'application/json; charset=utf-8';
const TEXT = 'text/plain; charset=utf-8';

/** A response that never carries `Cache-Control`, to trip missing-cache rules. */
const UNCACHED: Readonly<Record<string, string>> = { 'content-type': JS };

/**
 * Resolves a request path to a deterministic response. Pure: no I/O, no clock,
 * no randomness — so the fixture is fully unit-testable without sockets.
 */
export function resolveRoute(pathname: string): RouteResponse {
  switch (pathname) {
    case '/':
      return { status: 200, headers: { 'content-type': HTML }, body: INDEX_HTML, delayMs: 0 };
    case '/spy':
      return { status: 200, headers: { 'content-type': HTML }, body: SPY_HTML, delayMs: 0 };
    case '/app.js':
      return {
        status: 200,
        headers: { 'content-type': JS, 'cache-control': 'public, max-age=3600' },
        body: APP_JS,
        delayMs: 0,
      };
    case '/duplicate':
      return { status: 200, headers: UNCACHED, body: APP_JS, delayMs: 0 };
    case '/nocache.js':
      return { status: 200, headers: UNCACHED, body: NOCACHE_JS, delayMs: 0 };
    case '/blocking.js':
      return {
        status: 200,
        headers: { 'content-type': JS, 'cache-control': 'public, max-age=3600' },
        body: BLOCKING_JS,
        delayMs: 0,
      };
    case '/sw.js':
      return { status: 200, headers: UNCACHED, body: SERVICE_WORKER_JS, delayMs: 0 };
    case '/slow':
      return {
        status: 200,
        headers: { 'content-type': JSON },
        body: '{"slow":true}',
        delayMs: SLOW_DELAY_MS,
      };
    case '/big':
      return { status: 200, headers: { 'content-type': TEXT }, body: bigPayload(), delayMs: 0 };
    case '/huge.png':
      return { status: 200, headers: { 'content-type': 'image/png' }, body: hugePng(), delayMs: 0 };
    case '/status/404':
      return { status: 404, headers: { 'content-type': HTML }, body: '<h1>404</h1>', delayMs: 0 };
    case '/status/500':
      return { status: 500, headers: { 'content-type': HTML }, body: '<h1>500</h1>', delayMs: 0 };
    case '/ok':
      return { status: 200, headers: { 'content-type': JSON }, body: '{"ok":true}', delayMs: 0 };
    case '/favicon.ico':
      return { status: 204, headers: {}, body: new Uint8Array(), delayMs: 0 };
    default:
      return { status: 404, headers: { 'content-type': TEXT }, body: 'not found', delayMs: 0 };
  }
}

/** Extracts the pathname of a request URL, tolerating a missing `req.url`. */
function pathnameOf(url: string | undefined): string {
  return new URL(url ?? '/', 'http://localhost').pathname;
}

/** Writes one resolved route to the socket, honouring `HEAD` and `delayMs`. */
async function respond(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const route = resolveRoute(pathnameOf(req.url));
  if (route.delayMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, route.delayMs);
    });
  }
  const body =
    typeof route.body === 'string' ? Buffer.from(route.body, 'utf8') : Buffer.from(route.body);
  res.writeHead(route.status, { ...route.headers, 'content-length': String(body.byteLength) });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/**
 * Starts the fixture on the given port (default {@link DEFAULT_PORT}; pass `0`
 * for an ephemeral port). The caller owns the servers life cycle via `close`.
 */
export async function startServer(
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
): Promise<RunningServer> {
  const server = createServer((req, res) => {
    void respond(req, res).catch(() => {
      res.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('fixture server did not bind to a TCP port');
  }
  return {
    server,
    port: address.port,
    origin: `http://${host}:${String(address.port)}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

/** Parses `BAD_SITE_PORT`, falling back to {@link DEFAULT_PORT} for invalid input. */
function portFromEnv(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_PORT;
}

const entry = process.argv[1];
const isDirectRun = entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (isDirectRun) {
  const running = await startServer(portFromEnv(process.env.BAD_SITE_PORT));
  process.stdout.write(`bad-site listening on ${running.origin}\n`);
}
