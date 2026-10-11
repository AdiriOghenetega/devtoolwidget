import type { NetworkEntry } from '../../core';

function headerLines(entry: NetworkEntry): string[] {
  if (entry.headers === undefined) {
    return [];
  }
  return Object.entries(entry.headers).map(([name, value]) => {
    const text = Array.isArray(value) ? value.join(', ') : value;
    return `${name}: ${String(text)}`;
  });
}

/** Builds a copy-as-cURL command for a network entry. Pure. */
export function toCurl(entry: NetworkEntry): string {
  const parts = ['curl -X', entry.method, `'${entry.url}'`];
  for (const header of headerLines(entry)) {
    parts.push('-H', `'${header}'`);
  }
  return parts.join(' ');
}

/** Builds a copy-as-fetch snippet for a network entry. Pure. */
export function toFetch(entry: NetworkEntry): string {
  const headers = entry.headers === undefined ? undefined : { ...entry.headers };
  const init = headers === undefined ? '' : `, headers: ${JSON.stringify(headers)}`;
  return `fetch(${JSON.stringify(entry.url)}, { method: ${JSON.stringify(entry.method)}${init} })`;
}
