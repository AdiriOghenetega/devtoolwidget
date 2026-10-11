import { z } from 'zod';
import {
  AGENT_CONFIG_MESSAGE,
  BRIDGE_ACK_MESSAGE,
  BRIDGE_CHANNEL,
  BRIDGE_COMMIT_MESSAGE,
  HANDSHAKE_MESSAGE,
  MAX_AGENT_LATENCY_MS,
  MAX_AGENT_REDACTION_RULES,
  MAX_AGENT_RULE_NAME_LENGTH,
  MAX_AGENT_RULE_PATTERN_LENGTH,
  MAX_BRIDGE_NONCE_LENGTH,
} from '../core';

/**
 * Zod schemas for the three bridge bootstrap messages. They are the **source of
 * truth** for these messages: the page-world agent validates them with
 * hand-written guards (to stay under its bundle budget), and an equivalence test
 * asserts the guards and these schemas always agree (ADR 0018).
 */
const nonceSchema = z.string().min(1).max(MAX_BRIDGE_NONCE_LENGTH);

/** The one-time handshake: carries the nonce the transferred port is bound to. */
export const handshakeSchema = z.strictObject({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(HANDSHAKE_MESSAGE),
  nonce: nonceSchema,
});

/** The agent's acknowledgement, echoing the nonce so the content script can verify. */
export const ackSchema = z.strictObject({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(BRIDGE_ACK_MESSAGE),
  nonce: nonceSchema,
});

/** The content script's commit, confirming it received the ack on this port. */
export const commitSchema = z.strictObject({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(BRIDGE_COMMIT_MESSAGE),
  nonce: nonceSchema,
});

export type HandshakeMessage = z.infer<typeof handshakeSchema>;
export type AckMessage = z.infer<typeof ackSchema>;
export type CommitMessage = z.infer<typeof commitSchema>;

/** The runtime configuration payload the agent applies (G13). */
export const agentConfigPayloadSchema = z.strictObject({
  captureLevel: z.enum(['minimal', 'standard', 'deep']),
  bodyCapture: z.boolean(),
  redactionRules: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(MAX_AGENT_RULE_NAME_LENGTH),
        pattern: z.string().min(1).max(MAX_AGENT_RULE_PATTERN_LENGTH),
        replacement: z.string().max(MAX_AGENT_RULE_PATTERN_LENGTH).exactOptional(),
      }),
    )
    .max(MAX_AGENT_REDACTION_RULES)
    .readonly(),
  latencyMs: z.number().int().min(0).max(MAX_AGENT_LATENCY_MS),
});

/** The `agent.config` bootstrap message, accepted only over the committed port. */
export const agentConfigSchema = z.strictObject({
  channel: z.literal(BRIDGE_CHANNEL),
  message: z.literal(AGENT_CONFIG_MESSAGE),
  config: agentConfigPayloadSchema,
});

export type AgentConfigMessage = z.infer<typeof agentConfigSchema>;
