import { getStateBySlot } from '../data/precomputed-state';
import type { MetricDataPoint } from '../lib/ai/monitoring/SimpleAnomalyDetector';
import type { TrendDataPoint } from '../lib/ai/monitoring/TrendPredictor';

export interface AnomalyResultItem {
  isAnomaly: boolean;
  severity: string;
  confidence: number;
  decisionSource: 'threshold' | 'statistical' | 'threshold+statistical';
  confidenceBasis: string;
  rationale: string[];
  currentValue: number;
  threshold: { upper: number; lower: number };
}

export interface TrendResultItem {
  trend: string;
  currentValue: number;
  predictedValue: number;
  changePercent: number;
  confidence: number;
}

export function toTrendDataPoints(metricPoints: MetricDataPoint[]): TrendDataPoint[] {
  return metricPoints.map((point) => ({ timestamp: point.timestamp, value: point.value }));
}

export function getHistoryForMetric(
  serverId: string,
  metric: string,
  currentValue: number
): MetricDataPoint[] {
  const currentSlot = getCurrentSlotIndex();
  const now = Date.now();
  const baseTime = now - (now % (10 * 60 * 1000));
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

function getCurrentSlotIndex(): number {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440;
  return Math.floor(kstMinutes / 10);
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
