import type {
  MonitoringSnapshot,
  MonitoringSourceMode,
} from '../services/monitoring/monitoring-data-source';

interface AnalyzeServerInsights {
  summary: string;
  recommendations: string[];
  confidence: number;
}

interface AnalyzeServerToolResults {
  anomalyDetection?: unknown;
  trendPrediction?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readMonitoringSourceMode(
  value: unknown
): MonitoringSourceMode | undefined {
  return value === 'replay-json' || value === 'live-otel' ? value : undefined;
}

export function buildAnalyzeBatchSummary(
  snapshot: MonitoringSnapshot
): string {
  const affectedServerCount = new Set(
    snapshot.riskSignals.map((signal) => signal.serverId)
  ).size;
  const criticalCount = snapshot.riskSignals.filter(
    (signal) => signal.severity === 'critical'
  ).length;
  const warningCount = snapshot.riskSignals.filter(
    (signal) => signal.severity === 'warning'
  ).length;

  if (snapshot.riskSignals.length === 0) {
    return `${snapshot.topology.totalServers}대 서버가 정상 범위입니다. 현재 즉시 조치가 필요한 risk signal은 없습니다.`;
  }

  return `${affectedServerCount}대 서버에서 ${snapshot.riskSignals.length}개 risk signal이 감지되었습니다. critical ${criticalCount}개, warning ${warningCount}개입니다.`;
}

export function buildDeterministicAnalyzeServerInsights(
  results: AnalyzeServerToolResults
): AnalyzeServerInsights {
  const anomalyData = isRecord(results.anomalyDetection)
    ? results.anomalyDetection
    : {};
  const trendData = isRecord(results.trendPrediction)
    ? results.trendPrediction
    : {};
  const trendSummary = isRecord(trendData.summary) ? trendData.summary : {};

  const hasAnomalies = readBoolean(anomalyData.hasAnomalies);
  const anomalyCount = readNumber(anomalyData.anomalyCount) ?? 0;
  const hasRisingTrends = readBoolean(trendSummary.hasRisingTrends);

  if (hasAnomalies) {
    return {
      summary: `이상 탐지에서 ${anomalyCount}개 항목이 감지되었습니다. 관련 서버의 CPU, Memory, Disk 지표를 우선 확인하세요.`,
      recommendations: [
        '이상 감지된 메트릭의 최근 10분 변화와 직전 배포/배치 작업을 대조하세요.',
        '영향 서버의 상위 프로세스와 연결 수를 확인하고 필요 시 트래픽 분산을 적용하세요.',
      ],
      confidence: 0.88,
    };
  }

  if (hasRisingTrends) {
    return {
      summary:
        '현재 이상 탐지는 정상이지만 일부 지표에 상승 추세가 있습니다. 임계값 도달 가능성을 계속 관찰하세요.',
      recommendations: [
        '상승 추세가 있는 메트릭의 다음 1시간 예측값과 임계값까지의 여유를 확인하세요.',
        '동일 추세가 10분 이상 유지되면 관련 서버의 예약 작업과 트래픽 증가 요인을 점검하세요.',
      ],
      confidence: 0.84,
    };
  }

  return {
    summary:
      '이상 탐지와 추세 예측 모두 안정적입니다. 현재는 즉시 조치가 필요한 서버가 없습니다.',
    recommendations: [
      '현재 모니터링 주기를 유지하세요.',
      '리소스 사용률 상위 서버는 정기 점검 대상으로만 추적하세요.',
    ],
    confidence: 0.9,
  };
}
