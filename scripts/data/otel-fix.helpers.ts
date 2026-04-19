export type ScenarioMetricKey = 'cpu' | 'memory' | 'disk' | 'network';

const SCENARIO_THRESHOLDS: Record<
  ScenarioMetricKey,
  { warning: number; critical: number }
> = {
  cpu: { warning: 0.8, critical: 0.9 },
  memory: { warning: 0.8, critical: 0.9 },
  disk: { warning: 0.8, critical: 0.9 },
  network: { warning: 0.7, critical: 0.85 },
};

const SCENARIO_MIN_VALUE = 0.01;
const SCENARIO_MAX_VALUE = 0.99;
const DEFAULT_SCENARIO_STDDEV = 0.015;
const SATURATED_CPU_STDDEV = 0.008;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function gaussianJitter(
  mean: number,
  stddev: number,
  rng: () => number = Math.random
): number {
  let u1 = 0;
  let u2 = 0;

  while (u1 <= Number.EPSILON) {
    u1 = rng();
  }
  while (u2 <= Number.EPSILON) {
    u2 = rng();
  }

  const magnitude = Math.sqrt(-2 * Math.log(u1));
  const z0 = magnitude * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

export function getScenarioStddev(
  metricKey: ScenarioMetricKey,
  target: number
): number {
  return metricKey === 'cpu' && target > 0.8
    ? SATURATED_CPU_STDDEV
    : DEFAULT_SCENARIO_STDDEV;
}

export function applyScenarioJitter(
  target: number,
  slotOffset: number,
  metricKey: ScenarioMetricKey,
  rng: () => number = Math.random
): number {
  const stddev = getScenarioStddev(metricKey, target);
  const jitter = gaussianJitter(0, stddev, rng);
  let value = clampNumber(
    target + slotOffset + jitter,
    SCENARIO_MIN_VALUE,
    SCENARIO_MAX_VALUE
  );

  const threshold = SCENARIO_THRESHOLDS[metricKey];
  if (target >= threshold.critical && value < threshold.critical) {
    value = threshold.critical + rng() * 0.02;
  } else if (
    target >= threshold.warning &&
    target < threshold.critical &&
    value < threshold.warning
  ) {
    value = threshold.warning + rng() * 0.02;
  }

  return clampNumber(value, SCENARIO_MIN_VALUE, SCENARIO_MAX_VALUE);
}
