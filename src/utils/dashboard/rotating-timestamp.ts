const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEFAULT_REALTIME_THRESHOLD_HOURS = 36;
const DEFAULT_FUTURE_TOLERANCE_MINUTES = 5;

type RotatingTimestampOptions = {
  anchorDate?: Date;
  realtimeThresholdHours?: number;
  futureToleranceMinutes?: number;
};

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function getKstDateTimeParts(value: Date): DateTimeParts {
  const shifted = new Date(value.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

function createDateFromKstParts(parts: DateTimeParts): Date {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    ) - KST_OFFSET_MS
  );
}

export function formatDashboardDateTime(value: Date): string {
  const parts = getKstDateTimeParts(value);
  return `${parts.year}.${pad2(parts.month)}.${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function resolveRotatingTimestamp(
  isoString: string,
  options: RotatingTimestampOptions = {}
): Date | null {
  const parsed = new Date(isoString);
  if (!isValidDate(parsed)) return null;

  const anchor = options.anchorDate ?? new Date();
  if (!isValidDate(anchor)) return parsed;

  const realtimeThresholdHours =
    options.realtimeThresholdHours ?? DEFAULT_REALTIME_THRESHOLD_HOURS;
  const realtimeThresholdMs = realtimeThresholdHours * 60 * 60 * 1000;
  const sourceDiffMs = Math.abs(anchor.getTime() - parsed.getTime());

  // 실제 실시간 데이터로 보이는 경우 원본 날짜 유지
  if (sourceDiffMs <= realtimeThresholdMs) {
    return parsed;
  }

  // 24시간 순환 샘플: 접속 시점 날짜에 시각만 결합해 표시
  const anchorParts = getKstDateTimeParts(anchor);
  const parsedParts = getKstDateTimeParts(parsed);
  let anchoredMs = createDateFromKstParts({
    year: anchorParts.year,
    month: anchorParts.month,
    day: anchorParts.day,
    hour: parsedParts.hour,
    minute: parsedParts.minute,
    second: parsedParts.second,
    millisecond: parsedParts.millisecond,
  }).getTime();

  const futureToleranceMinutes =
    options.futureToleranceMinutes ?? DEFAULT_FUTURE_TOLERANCE_MINUTES;
  const futureToleranceMs = futureToleranceMinutes * 60 * 1000;
  const anchorMs = anchor.getTime();

  if (anchoredMs - anchorMs > futureToleranceMs) {
    anchoredMs -= DAY_MS;
  } else if (anchorMs - anchoredMs > DAY_MS + futureToleranceMs) {
    anchoredMs += DAY_MS;
  }

  return new Date(anchoredMs);
}

export function formatRotatingTimestamp(
  isoString: string,
  options: RotatingTimestampOptions = {}
): string {
  const resolved = resolveRotatingTimestamp(isoString, options);
  return resolved ? formatDashboardDateTime(resolved) : isoString;
}
