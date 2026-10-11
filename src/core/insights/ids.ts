/** FNV-1a hash of a string, as a stable hex string. */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * A deterministic finding id: stable across runs for the same rule and key
 * (usually a URL), so findings from successive snapshots can be diffed.
 */
export function stableFindingId(ruleId: string, key: string): string {
  return `${ruleId}:${hashString(`${ruleId}|${key}`)}`;
}
