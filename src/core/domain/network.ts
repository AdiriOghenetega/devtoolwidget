import type { Bytes, Millis } from './brands';

/** Timing phases for one network request (PRD section 9, FR-4). */
export interface NetworkTiming {
  readonly dns: Millis;
  readonly connect: Millis;
  readonly tls: Millis;
  readonly ttfb: Millis;
  readonly download: Millis;
  readonly total: Millis;
}

/** A header value after redaction. */
export type RedactedHeaderValue = string | readonly string[];

/** Redacted request/response headers. */
export type RedactedHeaders = Readonly<Record<string, RedactedHeaderValue>>;

/** A single captured network request (PRD section 9, FR-4). */
export interface NetworkEntry {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  /** HTTP status, or `null` when the request never completed. */
  readonly status: number | null;
  readonly resourceType: string;
  readonly transferSize: Bytes;
  readonly decodedSize: Bytes;
  readonly fromCache: boolean;
  readonly timing: NetworkTiming;
  readonly failure?: string;
  readonly headers?: RedactedHeaders;
}
