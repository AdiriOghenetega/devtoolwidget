import type { JSX } from 'preact';
import { t } from '../../i18n';

/** Props for {@link Sparkline}. */
export interface SparklineProps {
  readonly values: readonly number[];
  readonly width?: number;
  readonly height?: number;
  readonly ariaLabel?: string;
}

function toPoints(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) {
    return '';
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * A tiny accessible trend line. Rendered as an `img` role with an accessible
 * name so the data is announced.
 */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  ariaLabel,
}: SparklineProps): JSX.Element {
  return (
    <svg
      class="dwt-sparkline"
      role="img"
      aria-label={ariaLabel ?? t('sparkline.label')}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width}
      height={height}
    >
      <polyline
        points={toPoints(values, width, height)}
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </svg>
  );
}
