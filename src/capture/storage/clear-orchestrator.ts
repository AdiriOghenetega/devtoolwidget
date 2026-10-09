import {
  aggregateClearReport,
  planClear,
  type ClearReport,
  type ClearRequest,
  type ClearStep,
  type ClearStepResult,
} from '../../core';

/** Executes a single clear step in one runtime. */
export interface StepExecutor {
  execute(step: ClearStep): Promise<ClearStepResult>;
}

/** Dependencies for {@link ClearOrchestrator}. */
export interface ClearOrchestratorDeps {
  /** Runs page-context steps through the content script. */
  readonly page: StepExecutor;
  /** Runs `browsingData` steps in the service worker. */
  readonly background: StepExecutor;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Runs a clear request (PRD FR-6): plans the ordered steps, dispatches each to
 * the page or background executor, and aggregates a {@link ClearReport} with
 * per-step success, failure reasons and bytes freed. A step that throws becomes
 * a failure rather than aborting the rest.
 */
export class ClearOrchestrator {
  readonly #deps: ClearOrchestratorDeps;

  constructor(deps: ClearOrchestratorDeps) {
    this.#deps = deps;
  }

  async clear(request: ClearRequest): Promise<ClearReport> {
    const plan = planClear(request);
    const results: ClearStepResult[] = [];
    for (const step of plan.steps) {
      const executor = step.executor === 'page' ? this.#deps.page : this.#deps.background;
      try {
        results.push(await executor.execute(step));
      } catch (error: unknown) {
        results.push({
          stepId: step.id,
          ok: false,
          skipped: false,
          bytesFreed: 0,
          reason: describe(error),
        });
      }
    }
    return aggregateClearReport(results, plan.warnings);
  }
}
