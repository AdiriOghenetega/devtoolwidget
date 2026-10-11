import {
  AGENT_CONFIG_MESSAGE,
  BRIDGE_CHANNEL,
  MAX_AGENT_LATENCY_MS,
  MAX_AGENT_REDACTION_RULES,
  MAX_AGENT_RULE_NAME_LENGTH,
  MAX_AGENT_RULE_PATTERN_LENGTH,
  type AgentConfig,
  type AgentRedactionRule,
  type Result,
} from '../../core';
import type { PlatformError } from '../../platform/ports/errors';
import type { AgentConfigMessage } from '../../protocol';
import {
  booleanField,
  integerInRange,
  isRecordWithKeys,
  parseWith,
  stringField,
  type MessageSpec,
} from './validate';

/**
 * Hand-written, strict guard for the `agent.config` bootstrap message (G13), the
 * fourth Zod-free message the page-world agent handles (ADR 0018). It reuses the
 * shared table in `validate.ts`, is typed against the `z.infer` type of
 * `agentConfigSchema` (the source of truth in `protocol/bridge.ts`), is accepted
 * only on the committed secure port, and never throws.
 */

const nameField = stringField(1, MAX_AGENT_RULE_NAME_LENGTH);
const patternField = stringField(1, MAX_AGENT_RULE_PATTERN_LENGTH);
const replacementField = stringField(0, MAX_AGENT_RULE_PATTERN_LENGTH);
const latencyField = integerInRange(0, MAX_AGENT_LATENCY_MS);

function isCaptureLevel(value: unknown): value is AgentConfig['captureLevel'] {
  return value === 'minimal' || value === 'standard' || value === 'deep';
}

function parseRule(value: unknown): AgentRedactionRule | undefined {
  if (!isRecordWithKeys(value, ['name', 'pattern', 'replacement'])) {
    return undefined;
  }
  const { name, pattern, replacement } = value;
  if (!nameField(name) || !patternField(pattern)) {
    return undefined;
  }
  if (replacement !== undefined && !replacementField(replacement)) {
    return undefined;
  }
  return { name, pattern, ...(replacement === undefined ? {} : { replacement }) };
}

/** Validates and normalizes the config payload, or `undefined` when invalid. */
function normalizeConfig(value: unknown): AgentConfig | undefined {
  if (!isRecordWithKeys(value, ['captureLevel', 'bodyCapture', 'redactionRules', 'latencyMs'])) {
    return undefined;
  }
  const { captureLevel, bodyCapture, redactionRules, latencyMs } = value;
  if (!isCaptureLevel(captureLevel) || !booleanField(bodyCapture) || !latencyField(latencyMs)) {
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

/** Least-capture fallback; unreachable because `fields.config` validated first. */
const LEAST_CAPTURE: AgentConfig = {
  captureLevel: 'minimal',
  bodyCapture: false,
  redactionRules: [],
  latencyMs: 0,
};

const agentConfigSpec: MessageSpec<AgentConfigMessage> = {
  message: AGENT_CONFIG_MESSAGE,
  label: 'agent config',
  fields: { config: (value) => normalizeConfig(value) !== undefined },
  build: (data) => ({
    channel: BRIDGE_CHANNEL,
    message: AGENT_CONFIG_MESSAGE,
    config: normalizeConfig(data.config) ?? LEAST_CAPTURE,
  }),
};

/** Validates untrusted port data as an `agent.config` message. Never throws. */
export function parseAgentConfig(data: unknown): Result<AgentConfigMessage, PlatformError> {
  return parseWith(agentConfigSpec, data);
}

/** Builds an `agent.config` message from a configuration. */
export function createAgentConfig(config: AgentConfig): AgentConfigMessage {
  return { channel: BRIDGE_CHANNEL, message: AGENT_CONFIG_MESSAGE, config };
}
