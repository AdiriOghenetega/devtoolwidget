/**
 * Static page assets served by the `bad-site` E2E fixture.
 *
 * Every asset exists to reproduce one deliberate defect the extension should
 * diagnose (see `docs/E2E-TRACEABILITY.md`): parser-blocking scripts, an
 * unsized hero image, uncached resources, slow/erroring requests, a large
 * uncompressed payload, duplicate content and a service worker.
 */

/** Bytes in the intentionally large, uncompressed `/big` payload. */
export const BIG_PAYLOAD_BYTES = 1024 * 1024;

/** Padding added to the 1x1 PNG so `/huge.png` is large enough to rank. */
export const HUGE_PNG_BYTES = 256 * 1024;

/** Milliseconds `/slow` waits before responding, to trip slow-request rules. */
export const SLOW_DELAY_MS = 1500;

/** A real 1x1 transparent PNG (67 bytes) used as the header of `/huge.png`. */
const ONE_PIXEL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

/** A PNG whose declared bytes are far larger than its dimensions imply. */
export function hugePng(): Uint8Array {
  const bytes = new Uint8Array(HUGE_PNG_BYTES);
  bytes.set(ONE_PIXEL_PNG, 0);
  return bytes;
}

/** 1 MiB of ASCII, served with no `content-encoding` so it cannot be compressed. */
export function bigPayload(): string {
  return 'A'.repeat(BIG_PAYLOAD_BYTES);
}

export const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>devToolWidget bad site</title>
    <link rel="icon" href="/favicon.ico" />
    <script src="/blocking.js"></script>
    <script src="/nocache.js"></script>
  </head>
  <body>
    <h1>Staging environment</h1>
    <img src="/huge.png" alt="hero" />
    <button id="slow" type="button">Load slow data</button>
    <button id="missing" type="button">Request missing</button>
    <button id="error" type="button">Trigger error</button>
    <pre id="out"></pre>
    <script src="/app.js"></script>
  </body>
</html>
`;

export const APP_JS = `(function () {
  function render(text) {
    var out = document.getElementById('out');
    if (out) {
      out.textContent = String(text);
    }
  }

  function loadJson(path) {
    return fetch(path).then(function (response) {
      return response.text();
    });
  }

  document.getElementById('slow').addEventListener('click', function () {
    loadJson('/slow').then(render);
  });

  document.getElementById('missing').addEventListener('click', function () {
    loadJson('/status/404')
      .then(function (body) {
        console.error('missing resource', body.length);
        return loadJson('/big');
      })
      .catch(function (error) {
        console.error(error);
      });
  });

  document.getElementById('error').addEventListener('click', function () {
    loadJson('/status/500').catch(function (error) {
      console.error('server exploded', error);
    });
    throw new Error('Uncaught fixture error');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function (error) {
      console.error(error);
    });
  }
})();
`;

export const BLOCKING_JS = `(function () {
  var start = Date.now();
  while (Date.now() - start < 60) {
    // Busy-wait to create a long task in the critical rendering path.
  }
  console.log('blocking ready');
})();
`;

export const NOCACHE_JS = `console.log('served without cache headers');
`;

export const SERVICE_WORKER_JS = `self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
`;

/**
 * A page whose own script (registered after the main-world agent, with a
 * capturing listener to be maximally adversarial) tries to observe the bridge
 * handshake and any transferred ports. The agent must hide both.
 */
export const SPY_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>devToolWidget hostile page</title>
  </head>
  <body>
    <h1>Hostile page</h1>
    <script>
      window.__dtwSpy = { bridgeMessages: 0, transferredPorts: 0, capturedEvents: 0 };
      window.addEventListener(
        'message',
        function (event) {
          var data = event.data;
          if (data && typeof data === 'object' && data.channel === 'devtoolwidget:bridge') {
            window.__dtwSpy.bridgeMessages += 1;
          }
          if (event.ports && event.ports.length > 0) {
            window.__dtwSpy.transferredPorts += event.ports.length;
          }
          if (data && typeof data === 'object' && data.type === 'event.batch') {
            window.__dtwSpy.capturedEvents += 1;
          }
        },
        true,
      );
    </script>
  </body>
</html>
`;
