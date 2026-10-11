import type { Millis, TabId } from './brands';
import type { ConsoleEntry } from './console';
import type { NetworkEntry } from './network';
import type { LongTask, MemorySample, VitalMetric } from './performance';
import type { StorageSummary } from './storage';
import type { ImageSample, ResourceSample } from '../performance/derive';

/**
 * Everything the insights engine needs to judge one page (PRD section 9,
 * section 10). Insight rules are pure functions of a snapshot, so this is the
 * single input they read.
 *
 * `resources`, `images` and `memory` are optional: when a browser or capture
 * setting does not provide them, the rules that need them degrade to no findings
 * rather than erroring.
 */
export interface PageSnapshot {
  readonly tabId: TabId;
  readonly url: string;
  readonly capturedAt: Millis;
  readonly console: readonly ConsoleEntry[];
  readonly network: readonly NetworkEntry[];
  readonly vitals: readonly VitalMetric[];
  readonly longTasks: readonly LongTask[];
  readonly storage: StorageSummary;
  readonly resources?: readonly ResourceSample[];
  readonly images?: readonly ImageSample[];
  readonly memory?: readonly MemorySample[];
}
