const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const NOT_AVAILABLE = '\u2014';

/** Formats a byte count using SI units (1000-based), e.g. `1.5 KB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return NOT_AVAILABLE;
  }
  const sign = bytes < 0 ? '-' : '';
  let value = Math.abs(bytes);
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const amount = unitIndex === 0 ? String(Math.round(value)) : value.toFixed(value >= 100 ? 0 : 1);
  return `${sign}${amount} ${BYTE_UNITS[unitIndex] ?? 'B'}`;
}

/** Formats a duration in milliseconds, e.g. `120 ms`, `1.5 s`, `2.0 min`. */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) {
    return NOT_AVAILABLE;
  }
  const magnitude = Math.abs(milliseconds);
  if (magnitude < 1000) {
    return `${String(Math.round(milliseconds))} ms`;
  }
  if (magnitude < 60_000) {
    return `${(milliseconds / 1000).toFixed(1)} s`;
  }
  return `${(milliseconds / 60_000).toFixed(1)} min`;
}

/** Formats a fraction (0..1) as a percentage, e.g. `0.5` becomes `50%`. */
export function formatPercent(
  fraction: number,
  options: { readonly fractionDigits?: number } = {},
): string {
  if (!Number.isFinite(fraction)) {
    return NOT_AVAILABLE;
  }
  return `${(fraction * 100).toFixed(options.fractionDigits ?? 0)}%`;
}
