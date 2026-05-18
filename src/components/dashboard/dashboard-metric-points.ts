function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function withCurrentMetricPoint(
  values: number[],
  currentValue: number | undefined,
  options?: { clamp?: boolean }
): number[] {
  if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) {
    return values;
  }

  const normalizedValue =
    options?.clamp === true ? clampPercentage(currentValue) : currentValue;

  if (values.length === 0) {
    return [normalizedValue];
  }

  return [...values.slice(0, -1), normalizedValue];
}
