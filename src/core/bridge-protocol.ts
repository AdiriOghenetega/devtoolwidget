/**
 * Wire constants for the secure main-world bridge (PRD section 7).
 *
 * They live in `core` (the only layer both `protocol` and `capture` may import
 * without pulling Zod in) so the Zod schemas in `protocol/bridge.ts` and the
 * agent's hand-written guards in `capture/bridge/handshake.ts` share one source
 * of truth for the literal values. See ADR 0018.
 */

/** Namespace for bridge bootstrap messages. */
export const BRIDGE_CHANNEL = 'devtoolwidget:bridge';

/** One-time handshake message name. */
export const HANDSHAKE_MESSAGE = 'handshake';

/** Agent acknowledgement sent back over the freshly adopted port. */
export const BRIDGE_ACK_MESSAGE = 'ack';

/** Content acknowledgement that commits the agent to the adopted port. */
export const BRIDGE_COMMIT_MESSAGE = 'commit';

/** Nonce size in bytes. */
export const DEFAULT_NONCE_BYTES = 16;

/** Maximum accepted length of a bridge message's `nonce` (hex, defensively capped). */
export const MAX_BRIDGE_NONCE_LENGTH = 128;
