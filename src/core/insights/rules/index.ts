import type { InsightRule } from '../../domain/insight';
import { r01FailedRequests } from './r01-failed-requests';
import { r02SlowRequests } from './r02-slow-requests';
import { r03LargePayloads } from './r03-large-payloads';
import { r04UncompressedText } from './r04-uncompressed-text';
import { r05MissingCaching } from './r05-missing-caching';
import { r06DuplicateRequests } from './r06-duplicate-requests';
import { r07RequestVolume } from './r07-request-volume';
import { r08RenderBlocking } from './r08-render-blocking';
import { r09Lcp } from './r09-lcp';
import { r10Cls } from './r10-cls';
import { r11Inp } from './r11-inp';
import { r12LongTasks } from './r12-long-tasks';
import { r13ConsoleErrors } from './r13-console-errors';
import { r14SecurityConsole } from './r14-security-console';
import { r15OversizedImages } from './r15-oversized-images';
import { r16MemoryGrowth } from './r16-memory-growth';
import { r17StorageBloat } from './r17-storage-bloat';

/** Rules R01–R07 (network). */
export const NETWORK_RULES: readonly InsightRule[] = [
  r01FailedRequests,
  r02SlowRequests,
  r03LargePayloads,
  r04UncompressedText,
  r05MissingCaching,
  r06DuplicateRequests,
  r07RequestVolume,
];

/** Rules R08–R16 (performance). */
export const PERFORMANCE_RULES: readonly InsightRule[] = [
  r08RenderBlocking,
  r09Lcp,
  r10Cls,
  r11Inp,
  r12LongTasks,
  r13ConsoleErrors,
  r14SecurityConsole,
  r15OversizedImages,
  r16MemoryGrowth,
];

/** Rules R17 (storage). */
export const STORAGE_RULES: readonly InsightRule[] = [r17StorageBloat];

/** Every built-in insight rule. */
export const ALL_INSIGHT_RULES: readonly InsightRule[] = [
  ...NETWORK_RULES,
  ...PERFORMANCE_RULES,
  ...STORAGE_RULES,
];

export {
  r01FailedRequests,
  r02SlowRequests,
  r03LargePayloads,
  r04UncompressedText,
  r05MissingCaching,
  r06DuplicateRequests,
  r07RequestVolume,
  r08RenderBlocking,
  r09Lcp,
  r10Cls,
  r11Inp,
  r12LongTasks,
  r13ConsoleErrors,
  r14SecurityConsole,
  r15OversizedImages,
  r16MemoryGrowth,
  r17StorageBloat,
};
