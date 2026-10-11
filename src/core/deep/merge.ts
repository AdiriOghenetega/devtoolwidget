import { toBytes } from '../domain/brands';
import type { NetworkEntry, NetworkTiming, RedactedHeaders } from '../domain/network';

/** Accurate per-request data captured through the Debugger (CDP) path. */
export interface DeepNetworkData {
  readonly requestId: string;
  readonly url: string;
  readonly method: string;
  readonly status: number | null;
  readonly requestHeaders: RedactedHeaders;
  readonly responseHeaders: RedactedHeaders;
  readonly bodyPreview?: string;
  readonly timing: NetworkTiming;
  readonly encodedSize: number;
}

/** Which capture produced a merged entry. */
export type NetworkEntrySource = 'deep' | 'soft' | 'merged';

/** A merged entry plus its provenance. */
export interface MergedNetworkEntry {
  readonly entry: NetworkEntry;
  readonly source: NetworkEntrySource;
}

/**
 * Source-of-truth rules for merging deep (CDP) data with soft (Performance
 * Resource Timing / fetch+XHR) capture:
 *
 * 1. Deep data wins whenever it exists: URL, method, status, headers, timings
 *    and body all come from the Debugger, because CDP observes the wire.
 * 2. Soft data fills the gaps deep data does not carry: the inferred
 *    `resourceType`, cache state, decoded size and start time.
 * 3. A request seen only by one source uses that source unchanged.
 * 4. When neither source has the request, there is nothing to emit (`undefined`).
 *
 * Pure.
 */
export function mergeNetworkEntry(
  soft: NetworkEntry | undefined,
  deep: DeepNetworkData | undefined,
): MergedNetworkEntry | undefined {
  if (soft === undefined) {
    return deep === undefined ? undefined : { entry: deepOnlyEntry(deep), source: 'deep' };
  }
  if (deep === undefined) {
    return { entry: soft, source: 'soft' };
  }
  return {
    entry: {
      ...soft,
      method: deep.method,
      url: deep.url,
      status: deep.status,
      timing: deep.timing,
      transferSize: toBytes(deep.encodedSize),
      headers: { ...deep.requestHeaders, ...deep.responseHeaders },
      ...(deep.bodyPreview === undefined ? {} : { bodyPreview: deep.bodyPreview }),
    },
    source: 'merged',
  };
}

function deepOnlyEntry(deep: DeepNetworkData): NetworkEntry {
  return {
    id: deep.requestId,
    method: deep.method,
    url: deep.url,
    status: deep.status,
    resourceType: 'other',
    transferSize: toBytes(deep.encodedSize),
    decodedSize: toBytes(0),
    fromCache: false,
    timing: deep.timing,
    headers: deep.responseHeaders,
    ...(deep.bodyPreview === undefined ? {} : { bodyPreview: deep.bodyPreview }),
  };
}
