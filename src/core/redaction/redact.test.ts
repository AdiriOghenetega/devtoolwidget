import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REDACTION_OPTIONS,
  REDACTION_PLACEHOLDER,
  isSensitiveKey,
  redactHeaders,
  redactString,
  redactUrl,
} from './redact';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('isSensitiveKey', () => {
  it('matches explicit and API-key / token / secret shaped names', () => {
    expect(isSensitiveKey('Authorization', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(
      true,
    );
    expect(isSensitiveKey('X-Api-Key', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(true);
    expect(isSensitiveKey('apikey', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(true);
    expect(isSensitiveKey('x-auth-token', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(
      true,
    );
    expect(isSensitiveKey('client_secret', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(
      true,
    );
    expect(isSensitiveKey('content-type', DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames)).toBe(
      false,
    );
  });
});

describe('redactHeaders', () => {
  it('redacts sensitive headers whatever their casing and keeps the rest', () => {
    const redacted = redactHeaders({
      AuThOrIzAtIoN: 'Bearer secret',
      'Set-Cookie': 'session=abc; HttpOnly',
      'x-api-key': 'k-123',
      'content-type': 'application/json',
    });

    expect(redacted.AuThOrIzAtIoN).toBe(REDACTION_PLACEHOLDER);
    expect(redacted['Set-Cookie']).toBe(REDACTION_PLACEHOLDER);
    expect(redacted['x-api-key']).toBe(REDACTION_PLACEHOLDER);
    expect(redacted['content-type']).toBe('application/json');
  });

  it('redacts every value of a multi-valued sensitive header', () => {
    const redacted = redactHeaders({ Cookie: ['a=1', 'b=2'] });
    expect(redacted.Cookie).toBe(REDACTION_PLACEHOLDER);
  });

  it('never leaks a sensitive header value (property)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (name: string, value: string) => {
        const redacted = redactHeaders({ [`X-Api-Key-${name}`]: value });
        expect(Object.values(redacted)).toEqual([REDACTION_PLACEHOLDER]);
      }),
    );
  });
});

describe('redactUrl', () => {
  it('redacts sensitive query parameters and keeps other parameters', () => {
    const redacted = redactUrl('https://example.com/cb?access_token=abc&page=2&api_key=xyz');
    expect(redacted).toContain('page=2');
    expect(redacted).not.toContain('abc');
    expect(redacted).not.toContain('xyz');
    expect(redacted).toContain(
      `${encodeURIComponent('access_token')}=${encodeURIComponent(REDACTION_PLACEHOLDER)}`,
    );
  });

  it('redacts URL userinfo', () => {
    expect(redactUrl('https://user:pass@example.com/')).toBe(
      `https://${REDACTION_PLACEHOLDER}:${REDACTION_PLACEHOLDER}@example.com/`,
    );
  });

  it('redacts an encoded token value by parameter name', () => {
    const redacted = redactUrl(`https://example.com/?token=${encodeURIComponent(JWT)}`);
    expect(redacted).not.toContain('eyJ');
  });

  it('falls back to query redaction for an unparseable URL', () => {
    const redacted = redactUrl('/relative?token=abc&page=1');
    expect(redacted).not.toContain('abc');
    expect(redacted).toContain('page=1');
  });
});

describe('redactString', () => {
  it('redacts Bearer tokens regardless of casing', () => {
    expect(redactString('Authorization: bEaReR abcdef.12345')).toBe(
      `Authorization: Bearer ${REDACTION_PLACEHOLDER}`,
    );
  });

  it('redacts JWT-shaped strings', () => {
    expect(redactString(`token ${JWT} end`)).toBe(`token ${REDACTION_PLACEHOLDER} end`);
  });

  it('leaves ordinary text untouched', () => {
    expect(redactString('just a normal sentence')).toBe('just a normal sentence');
  });

  it('applies configurable extra rules', () => {
    const redacted = redactString('card 4111-1111-1111-1111', {
      extraRules: [{ name: 'pan', pattern: /\d{4}-\d{4}-\d{4}-\d{4}/g }],
    });
    expect(redacted).toBe(`card ${REDACTION_PLACEHOLDER}`);
  });

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const once = redactString(input);
        expect(redactString(once)).toBe(once);
      }),
    );
  });

  it('never leaves a JWT in the output (property)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (before: string, after: string) => {
        const output = redactString(`${before} ${JWT} ${after}`);
        expect(output).not.toContain(JWT);
      }),
    );
  });

  it('redacts tokens in a very long input', () => {
    const long = `${'a'.repeat(100_000)} Bearer ${'b'.repeat(100_000)}`;
    const redacted = redactString(long);
    expect(redacted).not.toContain('b'.repeat(1000));
    expect(redacted).toContain(REDACTION_PLACEHOLDER);
  });

  it('redacts a mixed-case, encoded-looking token (adversarial)', () => {
    const redacted = redactString(
      `HEADER Authorization: Bearer ${'x'.repeat(5000)}.${'y'.repeat(5000)}`,
    );
    expect(redacted).not.toContain('y'.repeat(1000));
  });
});
