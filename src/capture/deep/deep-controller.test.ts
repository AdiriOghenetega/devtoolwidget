import { describe, expect, it, vi } from 'vitest';
import { toTabId, type Result } from '../../core';
import { platformError } from '../../platform/ports';
import { createFakeDebuggerPort, createFakePermissionsPort } from '../../platform/fakes';
import type { DebuggerPort, PlatformError } from '../../platform/ports';
import { DeepController } from './deep-controller';

const TAB = toTabId(1);

function configuredDebugger(overrides: readonly string[] = []) {
  const debuggerFake = createFakeDebuggerPort();
  for (const method of ['Network.enable', 'Log.enable', 'Performance.enable', ...overrides]) {
    debuggerFake.setResponse(method, {});
  }
  return debuggerFake;
}

describe('DeepController', () => {
  it('requests the debugger permission, attaches and enables the CDP domains', async () => {
    const debuggerFake = configuredDebugger();
    const permissions = createFakePermissionsPort();
    const controller = new DeepController({ debugger: debuggerFake, permissions });

    const result = await controller.enable(TAB);

    expect(result.ok).toBe(true);
    expect(controller.isAttached(TAB)).toBe(true);
    expect(debuggerFake.attached).toContain(TAB);
  });

  it('does not attach when the debugger permission is declined', async () => {
    const debuggerFake = configuredDebugger();
    const permissions = createFakePermissionsPort();
    permissions.setRequestResult(false);
    const controller = new DeepController({ debugger: debuggerFake, permissions });

    const result = await controller.enable(TAB);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('permission-denied');
    }
    expect(controller.isAttached(TAB)).toBe(false);
  });

  it('detects an already-attached DevTools session and refuses', async () => {
    const failing: DebuggerPort = {
      attach: () =>
        Promise.resolve({
          ok: false,
          error: platformError('unsupported', 'Another debugger is already attached to the tab.'),
        }),
      detach: () => Promise.resolve({ ok: true, value: undefined }),
      sendCommand: (): Promise<Result<unknown, PlatformError>> =>
        Promise.resolve({ ok: true, value: {} }),
      onEvent: () => () => undefined,
    };
    const controller = new DeepController({ debugger: failing });

    const result = await controller.enable(TAB);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported');
      expect(result.error.message).toContain('DevTools');
    }
  });

  it('applies network and CPU throttling with the exact CDP methods', async () => {
    const debuggerFake = configuredDebugger([
      'Network.emulateNetworkConditions',
      'Emulation.setCPUThrottlingRate',
      'Network.setCacheDisabled',
    ]);
    const controller = new DeepController({ debugger: debuggerFake });
    await controller.enable(TAB);

    const throttle = await controller.setNetworkThrottle(TAB, {
      offline: false,
      latency: 200,
      downloadThroughput: 500_000,
      uploadThroughput: 250_000,
    });
    expect(throttle.ok).toBe(true);

    expect((await controller.setCpuThrottle(TAB, 4)).ok).toBe(true);
    const invalid = await controller.setCpuThrottle(TAB, 0.5);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe('invalid-argument');
    }

    expect((await controller.setCacheDisabled(TAB, true)).ok).toBe(true);
  });

  it('detaches cleanly on disable and dispose', async () => {
    const debuggerFake = configuredDebugger();
    const controller = new DeepController({ debugger: debuggerFake });

    await controller.enable(TAB);
    await controller.disable(TAB);
    expect(controller.isAttached(TAB)).toBe(false);
    expect(debuggerFake.attached).not.toContain(TAB);

    await controller.enable(TAB);
    await controller.dispose();
    expect(controller.isAttached(TAB)).toBe(false);
  });

  it('marks the session detached when a detach event arrives', async () => {
    const debuggerFake = configuredDebugger();
    const controller = new DeepController({ debugger: debuggerFake });
    const seen = vi.fn();
    controller.onEvent(seen);

    await controller.enable(TAB);
    debuggerFake.emit({ tabId: TAB }, 'Inspector.detached', {});

    expect(controller.isAttached(TAB)).toBe(false);
    expect(seen).toHaveBeenCalledWith(TAB, 'Inspector.detached', {});
  });
});
