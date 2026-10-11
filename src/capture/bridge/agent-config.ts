import {
  AGENT_CONFIG_MESSAGE,
  BRIDGE_CHANNEL,
  MAX_AGENT_LATENCY_MS,
  MAX_AGENT_REDACTION_RULES,
  MAX_AGENT_RULE_NAME_LENGTH,
  MAX_AGENT_RULE_PATTERN_LENGTH,
  err,
  ok,
  type AgentConfig,
  type AgentRedactionRule,
  type Result,
} from '../../core';
import { platformError, type PlatformError } from '../../platform/ports/errors';
import type { AgentConfigMessage } from '../../protocol';

/**
 * Hand-written, strict guard for the `agent.config` bootstrap message (G13), the
 * fourth and last Zod-free message the page-world agent handles (ADR 0018). It is
 * typed against the `z.infer` type of `agentConfigSchema` (the source of truth in
 * `protocol/bridge.ts`), is strict (exact own keys, enum/type checks, length and
 * count caps), is accepted only on the committed secure port, and never throws.
 * The equivalence test asserts it always agrees with the schema.
 */

/** True when `value` is a non-array object with no unknown own enumerable keys. */
function isRecordWithKeys(
  value: unknown,
  allowed: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return false;
    }
  }
  return true;
}

function isCaptureLevel(value: unknown): value is AgentConfig['captureLevel'] {
  return value === 'minimal' || value === 'standard' || value === 'deep';
}

function parseRule(value: unknown): AgentRedactionRule | undefined {
  if (!isRecordWithKeys(value, ['name', 'pattern', 'replacement'])) {
    return undefined;
  }
  const { name, pattern, replacement } = value;
  if (typeof name !== 'string' || name.length < 1 || name.length > MAX_AGENT_RULE_NAME_LENGTH) {
    return undefined;
  }
  if (
    typeof pattern !== 'string' ||
    pattern.length < 1 ||
    pattern.length > MAX_AGENT_RULE_PATTERN_LENGTH
  ) {
    return undefined;
  }
  if (
    replacement !== undefined &&
    (typeof replacement !== 'string' || replacement.length > MAX_AGENT_RULE_PATTERN_LENGTH)
  ) {
    return undefined;
  }
  return { name, pattern, ...(replacement === undefined ? {} : { replacement }) };
}

function parseConfig(value: unknown): AgentConfig | undefined {
  if (!isRecordWithKeys(value, ['captureLevel', 'bodyCapture', 'redactionRules', 'latencyMs'])) {
    return undefined;
  }
  const { captureLevel, bodyCapture, redactionRules, latencyMs } = value;
  if (!isCaptureLevel(captureLevel) || typeof bodyCapture !== 'boolean') {
    return undefined;
  }
  if (
    typeof latencyMs !== 'number' ||
    !Number.isInteger(latencyMs) ||
    latencyMs < 0 ||
    latencyMs > MAX_AGENT_LATENCY_MS
  ) {
    return undefined;
  }
  if (!Array.isArray(redactionRules) || redactionRules.length > MAX_AGENT_REDACTION_RULES) {
    return undefined;
  }
  const rules: AgentRedactionRule[] = [];
  for (const entry of redactionRules) {
    const rule = parseRule(entry);
    if (rule === undefined) {
      return undefined;
    }
    rules.push(rule);
  }
  return { captureLevel, bodyCapture, redactionRules: rules, latencyMs };
}

/** Validates untrusted port data as an `agent.config` message. Never throws. */
export function parseAgentConfig(data: unknown): Result<AgentConfigMessage, PlatformError> {
  if (!isRecordWithKeys(data, ['channel', 'message', 'config'])) {
    return err(platformError('invalid-data', 'Not an agent config message'));
  }
  if (data.channel !== BRIDGE_CHANNEL || data.message !== AGENT_CONFIG_MESSAGE) {
    return err(platformError('invalid-data', 'Not an agent config message'));
  }
  const config = parseConfig(data.config);
  if (config === undefined) {
    return err(platformError('invalid-data', 'Invalid agent config'));
  }
  return ok({ channel: BRIDGE_CHANNEL, message: AGENT_CONFIG_MESSAGE, config });
}

/** Builds an `agent.config` message from a configuration. */
export function createAgentConfig(config: AgentConfig): AgentConfigMessage {
  return { channel: BRIDGE_CHANNEL, message: AGENT_CONFIG_MESSAGE, config };
}
