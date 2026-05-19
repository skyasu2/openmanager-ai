import { getStateBySlot } from '../data/precomputed-state';
import type { BaselineDriftResult, MetricDataPoint } from '../lib/ai/monitoring/SimpleAnomalyDetector';
import type { TrendDataPoint } from '../lib/ai/monitoring/TrendPredictor';

/** 외부 데이터 소스에서 제공하는 서버별 메트릭 히스토리 (10분 간격, 최근순) */
export type ExternalMetricHistory = Record<string, Record<string, number[]>>;
// 구조: { [serverId]: { cpu, memory, disk, network, load1, load5: number[] } }

export interface LightweightEvidenceContract {
  contractVersion: 1;
  mode: 'deterministic_evidence';
  toolRole: 'extract_metric_signals';
  llmRole: 'interpret_cause_impact_actions_from_evidence';
  signalStrengthMeaning: 'evidence_strength_not_incident_probability';
  limitations: [
    'not_trained_ml',
    'threshold_and_short_horizon_signals_only',
    'requires_llm_interpretation_for_causality'
  ];
}

/**
 * Analyst anomaly/trend tools stay intentionally lightweight.
 * They produce deterministic metric evidence; causal interpretation belongs to the LLM.
 */
export function getLightweightEvidenceContract(): LightweightEvidenceContract {
  return {
    contractVersion: 1,
    mode: 'deterministic_evidence',
    toolRole: 'extract_metric_signals',
    llmRole: 'interpret_cause_impact_actions_from_evidence',
    signalStrengthMeaning: 'evidence_strength_not_incident_probability',
    limitations: [
      'not_trained_ml',
      'threshold_and_short_horizon_signals_only',
      'requires_llm_interpretation_for_causality',
    ],
  };
}

export interface AnomalyResultItem {
  isAnomaly: boolean;
  severity: string;
  /** 추세 강도 (0–1): R² 기반 모델 적합도, "예측 정확도"가 아님 */
  signalStrength: number;
  decisionSource: 'threshold' | 'statistical' | 'threshold+statistical';
  analysisBasis: string;
  rationale: string[];
  currentValue: number;
  threshold: { upper: number; lower: number };
  baselineDrift?: BaselineDriftResult;
}

export interface TrendResultItem {
  trend: string;
  currentValue: number;
  /** 선택한 시간 범위 기준 선형 투영값 */
  projectedValue: number;
  changePercent: number;
  /** 추세 강도 (0–1): R² 기반 모델 적합도 */
  signalStrength: number;
  decisionSource?: 'linear_projection' | 'linear_projection+threshold';
  analysisBasis?: string;
  rationale?: string[];
}

export function toTrendDataPoints(metricPoints: MetricDataPoint[]): TrendDataPoint[] {
  return metricPoints.map((point) => ({ timestamp: point.timestamp, value: point.value }));
}

/**
 * 현재 슬롯 인덱스 (KST 기준 10분 단위).
 * 도구 호출 간 일관성을 위해 export하여 호출 시점에 한 번만 계산 후 전달 가능.
 */
export function getCurrentSlotIndex(): number {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440;
  return Math.floor(kstMinutes / 10);
}

/**
 * 서버 메트릭 히스토리 조회.
 *
 * 우선순위:
 * 1. externalHistory가 제공되면 해당 값 사용 (실서버/외부 데이터 소스)
 * 2. precomputed-state 144슬롯 순환 버퍼 폴백 (합성 OTel 데이터)
 *
 * @param externalHistory - 외부에서 주입하는 히스토리. 없으면 precomputed 폴백.
 */
export function getHistoryForMetric(
  serverId: string,
  metric: string,
  currentValue: number,
  fixedSlot?: number,
  externalHistory?: ExternalMetricHistory
): MetricDataPoint[] {
  const now = Date.now();
  const baseTime = now - (now % (10 * 60 * 1000));

  // 외부 히스토리가 있으면 그것을 사용
  if (externalHistory?.[serverId]?.[metric]) {
    const values = externalHistory[serverId][metric];
    return values.map((value, idx) => ({
      timestamp: baseTime - (values.length - 1 - idx) * 600000,
      value,
    }));
  }

  // 폴백: precomputed 144슬롯 순환 버퍼
  const currentSlot = fixedSlot ?? getCurrentSlotIndex();
  const points: MetricDataPoint[] = [];

  for (let i = 35; i >= 0; i--) {
    const slotIdx = ((currentSlot - i) % 144 + 144) % 144;
    const slot = getStateBySlot(slotIdx);
    const server = slot?.servers.find((item) => item.id === serverId);
    if (server) {
      points.push({
        timestamp: baseTime - i * 600000,
        value: (server[metric as keyof typeof server] as number) ?? 0,
      });
    } else {
      points.push({
        timestamp: baseTime - i * 600000,
        value: currentValue,
      });
    }
  }

  return points;
}

export const PATTERN_INSIGHTS: Record<string, string> = {
  system_performance:
    '시스템 성능 분석: CPU 사용률, 프로세스 수, 로드 평균 확인 필요',
  memory_status:
    '메모리 상태 분석: 사용량, 캐시, 스왑 사용률 확인 필요',
  storage_info:
    '스토리지 분석: 디스크 사용량, I/O 대기, 파티션 상태 확인 필요',
  server_status:
    '서버 상태 분석: 가동 시간, 서비스 상태, 네트워크 연결 확인',
  trend_analysis:
    '트렌드 분석: 시계열 데이터 기반 패턴 인식 및 예측 모델 적용',
  anomaly_detection:
    '이상 탐지: 통계적 이상치 감지, 임계값 기반 알림 확인',
};
