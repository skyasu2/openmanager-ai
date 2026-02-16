const DAY_MS = 24 * 60 * 60 * 1000;
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

export function formatDashboardDateTime(value: Date): string {
  return `${value.getFullYear()}.${pad2(value.getMonth() + 1)}.${pad2(
    value.getDate()
  )} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(
    value.getSeconds()
  )}`;
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
  const anchored = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds(),
    parsed.getMilliseconds()
  );

  const futureToleranceMinutes =
    options.futureToleranceMinutes ?? DEFAULT_FUTURE_TOLERANCE_MINUTES;
  const futureToleranceMs = futureToleranceMinutes * 60 * 1000;

  if (anchored.getTime() - anchor.getTime() > futureToleranceMs) {
    anchored.setDate(anchored.getDate() - 1);
  } else if (
    anchor.getTime() - anchored.getTime() >
    DAY_MS + futureToleranceMs
  ) {
    anchored.setDate(anchored.getDate() + 1);
  }

  return anchored;
}

export function formatRotatingTimestamp(
  isoString: string,
  options: RotatingTimestampOptions = {}
): string {
  const resolved = resolveRotatingTimestamp(isoString, options);
  return resolved ? formatDashboardDateTime(resolved) : isoString;
}
