import type { Bytes } from './brands';

/** A storage area tracked for the current origin (PRD FR-6). */
export type StorageArea =
  'cookies' | 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cacheStorage' | 'serviceWorkers';

/** Count and approximate size for one storage area. */
export interface StorageAreaUsage {
  readonly area: StorageArea;
  readonly count: number;
  readonly approximateSize: Bytes;
}

/** Per-origin storage usage across all tracked areas (PRD section 9, FR-6). */
export interface StorageSummary {
  readonly areas: readonly StorageAreaUsage[];
}
