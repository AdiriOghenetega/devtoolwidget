import type { RedactedHeaders, RedactedHeaderValue } from '../domain/network';

/** Placeholder substituted for a redacted value. */
export const REDACTION_PLACEHOLDER = 'REDACTED';

/** A configurable redaction rule applied to free-form strings. */
export interface RedactionRule {
  /** A human-readable name, used in tests and diagnostics. */
  readonly name: string;
  /** A global regular expression matching the text to replace. */
  readonly pattern: RegExp;
  /** Replacement text; defaults to the placeholder. */
  readonly replacement?: string;
}

/** How redaction is configured (PRD section 7). */
export interface RedactionOptions {
  readonly placeholder: string;
  /** Lower-cased header names that are always redacted. */
  readonly sensitiveHeaderNames: readonly string[];
  /** Query-string parameters that are always redacted. */
  readonly sensitiveQueryParams: readonly string[];
  /** Extra rules applied to free-form strings. */
  readonly extraRules: readonly RedactionRule[];
}

const BASE_SENSITIVE_HEADER_NAMES: readonly string[] = ['authorization', 'cookie', 'set-cookie'];

const BASE_SENSITIVE_QUERY_PARAMS: readonly string[] = [
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'api_key',
  'apikey',
  'key',
  'password',
  'passwd',
  'pwd',
  'secret',
  'client_secret',
  'auth',
  'authorization',
  'signature',
  'sig',
  'session',
  'sessionid',
  'jwt',
  'code',
];

/** Default redaction configuration. Custom names extend these, never replace. */
export const DEFAULT_REDACTION_OPTIONS: RedactionOptions = {
  placeholder: REDACTION_PLACEHOLDER,
  sensitiveHeaderNames: BASE_SENSITIVE_HEADER_NAMES,
  sensitiveQueryParams: BASE_SENSITIVE_QUERY_PARAMS,
  extraRules: [],
};

const SENSITIVE_KEY_PATTERN =
  /(^|[^a-z])(authorization|cookie|api[-_]?key|apikey|token|secret|password|passwd|pwd|auth)([^a-z]|$)/;

const BEARER_PATTERN = /\bbearer\s+[a-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi;

function resolveOptions(options: Partial<RedactionOptions> | undefined): RedactionOptions {
  return {
    placeholder: options?.placeholder ?? DEFAULT_REDACTION_OPTIONS.placeholder,
    sensitiveHeaderNames:
      options?.sensitiveHeaderNames ?? DEFAULT_REDACTION_OPTIONS.sensitiveHeaderNames,
    sensitiveQueryParams:
      options?.sensitiveQueryParams ?? DEFAULT_REDACTION_OPTIONS.sensitiveQueryParams,
    extraRules: options?.extraRules ?? DEFAULT_REDACTION_OPTIONS.extraRules,
  };
}

/**
 * True when a header or query-parameter name is sensitive by exact match or by
 * an API-key / token / secret / auth shaped name (case-insensitive).
 */
export function isSensitiveKey(name: string, explicitNames: readonly string[]): boolean {
  const lower = name.toLowerCase();
  if (explicitNames.includes(lower)) {
    return true;
  }
  return SENSITIVE_KEY_PATTERN.test(lower);
}

/** Redacts sensitive response/request headers, preserving every key. */
export function redactHeaders(
  headers: Readonly<Record<string, RedactedHeaderValue>>,
  options?: Partial<RedactionOptions>,
): RedactedHeaders {
  const resolved = resolveOptions(options);
  const result: Record<string, RedactedHeaderValue> = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name] = isSensitiveKey(name, resolved.sensitiveHeaderNames)
      ? resolved.placeholder
      : value;
  }
  return result;
}

function redactQueryStringFallback(input: string, options: RedactionOptions): string {
  const marker = options.placeholder;
  return input.replace(/([?&])([^=&#?]+)=([^&#]*)/g, (match, separator: string, key: string) => {
    return isSensitiveKey(key, options.sensitiveQueryParams)
      ? `${separator}${key}=${marker}`
      : match;
  });
}

/** Redacts sensitive query parameters and URL userinfo, preserving the shape. */
export function redactUrl(input: string, options?: Partial<RedactionOptions>): string {
  const resolved = resolveOptions(options);
  try {
    const url = new URL(input);
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveKey(key, resolved.sensitiveQueryParams)) {
        url.searchParams.set(key, resolved.placeholder);
      }
    }
    if (url.username !== '') {
      url.username = resolved.placeholder;
    }
    if (url.password !== '') {
      url.password = resolved.placeholder;
    }
    return url.toString();
  } catch {
    return redactQueryStringFallback(input, resolved);
  }
}

/** Redacts Bearer tokens, JWT-shaped strings and any configured extra rules. */
export function redactString(input: string, options?: Partial<RedactionOptions>): string {
  const resolved = resolveOptions(options);
  let output = input;
  output = output.replace(BEARER_PATTERN, `Bearer ${resolved.placeholder}`);
  output = output.replace(JWT_PATTERN, resolved.placeholder);
  for (const rule of resolved.extraRules) {
    output = output.replace(rule.pattern, rule.replacement ?? resolved.placeholder);
  }
  return output;
}
