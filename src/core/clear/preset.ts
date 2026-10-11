import type { ClearStoragePreset } from '../domain/finding';
import type { ClearRequest } from './clear-plan';

/** The data a "fresh visitor" preset clears for the current origin (PRD FR-6). */
const FRESH_VISITOR_TYPES = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'cacheStorage',
  'serviceWorkers',
  'cookies',
] as const;

/**
 * Expands a UI clear preset into a concrete {@link ClearRequest}. `fresh-visitor`
 * resets the current origin (so it needs a `origin`); when no origin is known it
 * falls back to clearing everything. `clear-everything-and-reload` clears all
 * origins and includes the HTTP cache.
 */
export function presetToClearRequest(preset: ClearStoragePreset, origin?: string): ClearRequest {
  if (preset === 'clear-everything-and-reload') {
    return { types: [...FRESH_VISITOR_TYPES, 'httpCache'], scope: 'all' };
  }
  if (origin === undefined) {
    return { types: [...FRESH_VISITOR_TYPES], scope: 'all' };
  }
  return { types: [...FRESH_VISITOR_TYPES], scope: 'origin', origin };
}
