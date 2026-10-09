import { describe, expect, it } from 'vitest';
import type { ClearStep } from '../../core';
import { ClearOrchestrator, type StepExecutor } from './clear-orchestrator';

function executor(
  result: (step: ClearStep) => { ok: boolean; bytesFreed: number; reason?: string },
): StepExecutor {
  return {
    execute: (step) =>
      Promise.resolve({
        stepId: step.id,
        skipped: false,
        ...result(step),
      }),
  };
}

describe('ClearOrchestrator', () => {
  it('dispatches steps to the right executor and aggregates the report', async () => {
    const page = executor(() => ({ ok: true, bytesFreed: 10 }));
    const background = executor(() => ({ ok: true, bytesFreed: 20 }));
    const orchestrator = new ClearOrchestrator({ page, background });

    const report = await orchestrator.clear({
      types: ['localStorage', 'cookies', 'httpCache'],
      scope: 'origin',
      origin: 'https://a.test',
    });

    expect(report.ok).toBe(true);
    expect(report.bytesFreed).toBe(60);
  });

  it('records partial failures without aborting and keeps the warnings', async () => {
    const page = executor(() => ({ ok: true, bytesFreed: 5 }));
    const background = executor(() => ({ ok: false, bytesFreed: 0, reason: 'permission denied' }));
    const orchestrator = new ClearOrchestrator({ page, background });

    const report = await orchestrator.clear({
      types: ['localStorage', 'httpCache'],
      scope: 'origin',
    });

    expect(report.ok).toBe(false);
    expect(report.bytesFreed).toBe(5);
    expect(report.failures.map((failure) => failure.stepId)).toEqual(['background:http-cache']);
  });

  it('turns a throwing executor into a failure', async () => {
    const throwing: StepExecutor = {
      execute: () => Promise.reject(new Error('boom')),
    };
    const orchestrator = new ClearOrchestrator({
      page: throwing,
      background: executor(() => ({ ok: true, bytesFreed: 1 })),
    });

    const report = await orchestrator.clear({ types: ['localStorage'], scope: 'origin' });

    expect(report.ok).toBe(false);
    expect(report.failures[0]?.reason).toContain('boom');
  });
});
