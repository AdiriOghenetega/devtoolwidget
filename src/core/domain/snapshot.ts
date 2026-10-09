import type { Millis, TabId } from './brands';
import type { ConsoleEntry } from './console';
import type { NetworkEntry } from './network';
import type { LongTask, VitalMetric } from './performance';
import type { StorageSummary } from './storage';

/**
 * Everything the insights engine needs to judge one page (PRD section 9,
 * section 10). Insight rules are pure functions of a snapshot, so this is the
 * single input they read.
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
}
