import type { InsightRule } from '../../domain/insight';
import { OTHER_RULES } from './other-rules';
import { r01FailedRequests } from './r01-failed-requests';
import { r02SlowRequests } from './r02-slow-requests';
import { r03LargePayloads } from './r03-large-payloads';
import { r04UncompressedText } from './r04-uncompressed-text';
import { r05MissingCaching } from './r05-missing-caching';
import { r06DuplicateRequests } from './r06-duplicate-requests';
import { r07RequestVolume } from './r07-request-volume';

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

/** Every built-in insight rule. */
export const ALL_INSIGHT_RULES: readonly InsightRule[] = [...NETWORK_RULES, ...OTHER_RULES];

export {
  OTHER_RULES,
  r01FailedRequests,
  r02SlowRequests,
  r03LargePayloads,
  r04UncompressedText,
  r05MissingCaching,
  r06DuplicateRequests,
  r07RequestVolume,
};
