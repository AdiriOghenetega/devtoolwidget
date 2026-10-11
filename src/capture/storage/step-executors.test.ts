import { describe, expect, it, vi } from 'vitest';
import { toTabId, type ClearStep } from '../../core';
import type { BrowsingDataPort, ScriptingPort } from '../../platform/ports';
import { createBackgroundClearExecutor, createPageClearExecutor } from './step-executors';

function step(overrides: Partial<ClearStep> = {}): ClearStep {
  return {
    id: 'background:http-cache',
    type: 'httpCache',
    executor: 'background',
    keep: [],
    httpOnly: false,
    origin: 'https://a.test',
    ...overrides,
  };
}

describe('createBackgroundClearExecutor', () => {
  it('maps a widget clear type onto browsingData scoped to the origin', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const browsingData: BrowsingDataPort = { remove };
    const executor = createBackgroundClearExecutor(browsingData);

    const result = await executor.execute(step());

    expect(result).toEqual({
      stepId: 'background:http-cache',
      ok: true,
      skipped: false,
      bytesFreed: 0,
    });
    expect(remove).toHaveBeenCalledWith({ dataToRemove: ['cache'], origins: ['https://a.test'] });
  });

  it('reports a browsingData failure without throwing', async () => {
    const browsingData: BrowsingDataPort = {
      remove: () =>
        Promise.resolve({ ok: false, error: { code: 'permission-denied', message: 'nope' } }),
    };
    const result = await createBackgroundClearExecutor(browsingData).execute(step());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('nope');
  });

  it('skips a type with no browsingData mapping', async () => {
    const browsingData: BrowsingDataPort = { remove: vi.fn() };
    const result = await createBackgroundClearExecutor(browsingData).execute(
      step({ type: 'fileSystems' as ClearStep['type'] }),
    );
    expect(result.skipped).toBe(true);
  });
});

describe('createPageClearExecutor', () => {
  it('injects the page step and maps its outcome back', async () => {
    const executeScript = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ stepId: 'page:localStorage', ok: true, skipped: false, bytesFreed: 42 }],
    });
    const scripting: ScriptingPort = {
      executeScript,
      insertCss: () => Promise.resolve({ ok: true, value: undefined }),
    };
    const executor = createPageClearExecutor(scripting, toTabId(7));

    const result = await executor.execute(
      step({ id: 'page:localStorage', type: 'localStorage', executor: 'page' }),
    );

    expect(result).toEqual({
      stepId: 'page:localStorage',
      ok: true,
      skipped: false,
      bytesFreed: 42,
    });
    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 7 }, world: 'MAIN' }),
    );
  });

  it('skips a step that belongs to the background', async () => {
    const scripting: ScriptingPort = {
      executeScript: vi.fn(),
      insertCss: () => Promise.resolve({ ok: true, value: undefined }),
    };
    const result = await createPageClearExecutor(scripting, toTabId(7)).execute(step());
    expect(result.skipped).toBe(true);
  });

  it('reports an injection failure', async () => {
    const scripting: ScriptingPort = {
      executeScript: () =>
        Promise.resolve({ ok: false, error: { code: 'not-found', message: 'gone' } }),
      insertCss: () => Promise.resolve({ ok: true, value: undefined }),
    };
    const result = await createPageClearExecutor(scripting, toTabId(7)).execute(
      step({ id: 'page:localStorage', type: 'localStorage', executor: 'page' }),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('gone');
  });
});
