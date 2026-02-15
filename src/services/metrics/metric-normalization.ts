/**
 * Metric normalization helpers for mixed OTel unit inputs.
 *
 * Goal:
 * - Keep alert/status pipeline in percent(0-100) domain.
 * - Absorb legacy payload quirks (e.g. system.network.io unit=By/s but value is already %).
 */

const DEFAULT_NETWORK_CAPACITY_BYTES_PER_SEC = 125_000_000; // 1Gbps

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isByteRateUnit(unit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.toLowerCase();
  return (
    normalized.includes('by/s') ||
    normalized.includes('byte/s') ||
    normalized.includes('bytes/s')
  );
}

/**
 * Generic utilization normalization to percent(0-100).
 * - ratio input(0~1): 0.73 -> 73
 * - percent input(0~100): keep as-is
 */
export function normalizeUtilizationPercent(
  value: number,
  unit?: string
): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return roundToTenth(value * 100);

  // unit='1' can still arrive as already-percent in some generated fixtures.
  if (unit?.toLowerCase() === '1') return roundToTenth(clampPercent(value));
  return roundToTenth(clampPercent(value));
}

/**
 * Network normalization to utilization percent(0-100).
 *
 * Supported cases:
 * - ratio input(0~1): convert to %
 * - legacy OTLP quirk: unit=By/s but value already 0~100 % -> keep as %
 * - real bytes/sec + unit=By/s: convert using default 1Gbps link capacity
 */
export function normalizeNetworkUtilizationPercent(
  value: number,
  unit?: string
): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return roundToTenth(value * 100);

  if (isByteRateUnit(unit)) {
    // Legacy fixture compatibility: value is already in percentage scale.
    if (value <= 100) return roundToTenth(clampPercent(value));

    const percent = (value / DEFAULT_NETWORK_CAPACITY_BYTES_PER_SEC) * 100;
    return roundToTenth(clampPercent(percent));
  }

  return roundToTenth(clampPercent(value));
}
