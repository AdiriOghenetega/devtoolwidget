import { z } from 'zod';
import { err, ok, type Result } from '../core';
import type { ProtocolError } from './errors';
import {
  ALL_MESSAGE_TYPES,
  COMMAND_MESSAGE_TYPES,
  EVENT_MESSAGE_TYPES,
  RESULT_MESSAGE_TYPES,
  commandMessageSchema,
  eventMessageSchema,
  protocolMessageSchema,
  resultMessageSchema,
  type CommandMessage,
  type EventMessage,
  type ProtocolMessage,
  type ResultMessage,
} from './messages';
import { PROTOCOL_VERSION } from './version';

const envelopeHeadSchema = z.object({
  type: z.string().min(1),
  version: z.number().int(),
  correlationId: z.string().min(1),
});

function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join('.');
    return `${path === '' ? '(root)' : path}: ${issue.message}`;
  });
}

/**
 * Validates a raw value against a message schema without ever throwing. It
 * checks the envelope head first (so an unknown or mismatched version is
 * reported precisely) and then the payload.
 */
function parseEnvelope<TMessage, TInput>(
  schema: z.ZodType<TMessage, TInput>,
  knownTypes: ReadonlySet<string>,
  input: unknown,
): Result<TMessage, ProtocolError> {
  const head = envelopeHeadSchema.safeParse(input);
  if (!head.success) {
    return err({
      code: 'invalid-message',
      message: 'Not a valid protocol envelope',
      details: describeIssues(head.error),
    });
  }
  if (head.data.version !== PROTOCOL_VERSION) {
    return err({
      code: 'version-mismatch',
      message: `Unsupported protocol version ${String(head.data.version)}`,
      details: [`this build speaks version ${String(PROTOCOL_VERSION)}`],
    });
  }
  if (!knownTypes.has(head.data.type)) {
    return err({
      code: 'unknown-type',
      message: `Unknown message type "${head.data.type}"`,
    });
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err({
      code: 'invalid-payload',
      message: `Invalid payload for "${head.data.type}"`,
      details: describeIssues(parsed.error),
    });
  }
  return ok(parsed.data);
}

/** Parses any protocol message. Never throws. */
export function parseMessage(input: unknown): Result<ProtocolMessage, ProtocolError> {
  return parseEnvelope(protocolMessageSchema, ALL_MESSAGE_TYPES, input);
}

/** Parses an event message. Never throws. */
export function parseEvent(input: unknown): Result<EventMessage, ProtocolError> {
  return parseEnvelope(eventMessageSchema, EVENT_MESSAGE_TYPES, input);
}

/** Parses a command message. Never throws. */
export function parseCommand(input: unknown): Result<CommandMessage, ProtocolError> {
  return parseEnvelope(commandMessageSchema, COMMAND_MESSAGE_TYPES, input);
}

/** Parses a command result message. Never throws. */
export function parseResult(input: unknown): Result<ResultMessage, ProtocolError> {
  return parseEnvelope(resultMessageSchema, RESULT_MESSAGE_TYPES, input);
}
