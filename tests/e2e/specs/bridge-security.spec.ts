import { expect, registerExtensionScripts, test } from '../fixtures/extension';

interface SpyCounters {
  readonly bridgeMessages: number;
  readonly transferredPorts: number;
  readonly capturedEvents: number;
}

/**
 * Bridge hardening (ADR 0011, integration gap G7). The page registers a
 * capturing `message` listener after the agent, which is the strongest position
 * a page script can reach, and must observe nothing: not the handshake, not a
 * transferred port, not a capture batch. The content script retries the
 * handshake while its retry window is shorter than the first round trip, so the
 * hostile listener is live for the later attempts this assertion depends on.
 */
test.describe('bridge security', () => {
  test('a hostile page script cannot observe the handshake, ports or traffic', async ({
    context,
    serviceWorker,
  }) => {
    await registerExtensionScripts(serviceWorker);

    const page = await context.newPage();
    await page.goto('/spy');

    // The bridge still completes normally despite the hostile listener.
    await expect(page.locator('devtoolwidget-root [data-devtoolwidget="status"]')).toHaveText(
      'pong',
    );

    const spy = await page.evaluate(() => (globalThis as { __dtwSpy?: SpyCounters }).__dtwSpy);
    expect(spy).toBeDefined();
    expect(spy?.bridgeMessages).toBe(0);
    expect(spy?.transferredPorts).toBe(0);
    expect(spy?.capturedEvents).toBe(0);
  });
});
