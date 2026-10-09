/**
 * The wire protocol version (PRD 8.2). Bump this on any breaking change to an
 * envelope, event or command payload. Receivers reject a different version with
 * a `version-mismatch` error instead of guessing.
 */
export const PROTOCOL_VERSION = 1;
