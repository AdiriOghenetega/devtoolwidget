import type { JSX } from 'preact';

export interface HealthBadgeProps {
  readonly score: number;
}

/**
 * Minimal health badge proving the Preact + Shadow-DOM UI wiring.
 */
export function HealthBadge({ score }: HealthBadgeProps): JSX.Element {
  return <output class="health-badge">{`Health ${String(score)}`}</output>;
}
