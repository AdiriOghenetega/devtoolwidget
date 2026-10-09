import { z } from 'zod';

/** The reason a protocol message could not be handled (PRD 8.2). */
export const protocolErrorCodeSchema = z.enum([
  'invalid-message',
  'invalid-payload',
  'unknown-type',
  'version-mismatch',
  'timeout',
  'unsupported',
  'internal',
]);

export type ProtocolErrorCode = z.infer<typeof protocolErrorCodeSchema>;

/** A structured, non-throwing error returned by the protocol. */
export const protocolErrorSchema = z.object({
  code: protocolErrorCodeSchema,
  message: z.string(),
  details: z.array(z.string()).optional(),
});

export type ProtocolError = z.infer<typeof protocolErrorSchema>;
