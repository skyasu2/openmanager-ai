import {
  MAX_PREDICTION_HORIZON,
  type MetricThresholds,
  type RecoveryPrediction,
  type ThresholdBreachPrediction,
} from './TrendPredictor.types';

export function determineStatus(
  value: number,
  thresholds: MetricThresholds
): 'online' | 'warning' | 'critical' {
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'online';
}

export function predictThresholdBreach(
  currentValue: number,
  slope: number,
  thresholds: MetricThresholds,
  currentStatus: 'online' | 'warning' | 'critical',
  maxPredictionHorizonMs: number = MAX_PREDICTION_HORIZON
): ThresholdBreachPrediction {
  if (currentStatus === 'critical') {
    return {
      willBreachWarning: true,
      timeToWarning: 0,
      willBreachCritical: true,
      timeToCritical: 0,
      humanReadable: '🚨 현재 심각(Critical) 상태 — 시스템 보호 메커니즘(OOM Killer, eviction 등) 발동 가능',
    };
  }

  if (slope <= 0) {
    return {
      willBreachWarning: currentStatus === 'warning',
      timeToWarning: currentStatus === 'warning' ? 0 : null,
      willBreachCritical: false,
      timeToCritical: null,
      humanReadable:
        currentStatus === 'warning'
          ? '현재 경고(Warning) 상태이며, 악화 추세 없음'
          : '정상 상태 유지 예상',
    };
  }

  let timeToWarning: number | null = null;
  let willBreachWarning = currentStatus === 'warning';

  if (currentStatus === 'online' && currentValue < thresholds.warning) {
    const timeSeconds = (thresholds.warning - currentValue) / slope;
    const timeMs = timeSeconds * 1000;

    if (timeMs > 0 && timeMs <= maxPredictionHorizonMs) {
      timeToWarning = timeMs;
      willBreachWarning = true;
    }
  }

  let timeToCritical: number | null = null;
  let willBreachCritical = false;

  if (currentValue < thresholds.critical) {
    const timeSeconds = (thresholds.critical - currentValue) / slope;
    const timeMs = timeSeconds * 1000;

    if (timeMs > 0 && timeMs <= maxPredictionHorizonMs) {
      timeToCritical = timeMs;
      willBreachCritical = true;
    }
  }

  const humanReadable = formatBreachMessage(
    willBreachWarning,
    timeToWarning,
    willBreachCritical,
    timeToCritical,
    currentStatus
  );

  return {
    willBreachWarning,
    timeToWarning,
    willBreachCritical,
    timeToCritical,
    humanReadable,
  };
}

export function predictRecovery(
  currentValue: number,
  slope: number,
  thresholds: MetricThresholds,
  currentStatus: 'online' | 'warning' | 'critical',
  maxPredictionHorizonMs: number = MAX_PREDICTION_HORIZON
): RecoveryPrediction {
  if (currentStatus === 'online') {
    return {
      willRecover: true,
      timeToRecovery: 0,
      humanReadable: null,
    };
  }

  if (slope >= 0) {
    return {
      willRecover: false,
      timeToRecovery: null,
      humanReadable:
        currentStatus === 'critical'
          ? '⚠️ 심각 상태이며, 자연 복구 예상 불가'
          : '⚠️ 경고 상태이며, 자연 복구 예상 불가',
    };
  }

  const timeSeconds = (thresholds.recovery - currentValue) / slope;
  const timeMs = timeSeconds * 1000;

  if (timeMs > 0 && timeMs <= maxPredictionHorizonMs) {
    return {
      willRecover: true,
      timeToRecovery: timeMs,
      humanReadable: `✅ ${formatDuration(timeMs)} 후 정상 복귀 예상`,
    };
  }

  return {
    willRecover: false,
    timeToRecovery: null,
    humanReadable: '복구 시간 예측 불가 (24시간 이상 소요 예상)',
  };
}

function formatBreachMessage(
  willBreachWarning: boolean,
  timeToWarning: number | null,
  willBreachCritical: boolean,
  timeToCritical: number | null,
  currentStatus: 'online' | 'warning' | 'critical'
): string {
  if (currentStatus === 'warning') {
    if (willBreachCritical && timeToCritical !== null) {
      return `⚠️ 현재 경고 상태 → ${formatDuration(timeToCritical)} 후 심각 상태 예상`;
    }
    return '⚠️ 현재 경고 상태 (심각 상태로의 전환 예상 없음)';
  }

  if (willBreachCritical && timeToCritical !== null) {
    return `🚨 ${formatDuration(timeToCritical)} 후 심각(Critical) 도달 예상 — 이후 시스템 보호 메커니즘 발동 가능`;
  }

  if (willBreachWarning && timeToWarning !== null) {
    return `⚠️ ${formatDuration(timeToWarning)} 후 경고(Warning) 상태 예상`;
  }

  return '✅ 24시간 내 임계값 도달 예상 없음';
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}일 ${remainingHours}시간` : `${days}일`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }

  if (minutes > 0) {
    return `${minutes}분`;
  }

  return '1분 미만';
}
