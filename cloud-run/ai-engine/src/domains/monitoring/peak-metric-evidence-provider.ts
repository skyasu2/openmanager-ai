import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
} from '../../core/assistant-runtime';
import { getMonitoringPeakMetric, type PeakMetricSlot } from './peak-metric';
import {
  type ParsedPeakMetricRequest,
  parseMonitoringPeakMetricFrame,
  parseMonitoringPeakMetricMessage,
} from './peak-metric-intent';

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function formatMetricValue(value: number, unit = ''): string {
  return `${formatNumber(value)}${unit}`;
}

function buildPeakMetricFallbackAnswer(peak: PeakMetricSlot): string {
  const topServers = peak.topServers
    .map(
      (server, index) =>
        `${index + 1}. ${server.name} (${server.id}): ${formatMetricValue(
          server.value,
          peak.unit
        )}`
    )
    .join('\n');
  const fallbackNotice = peak.usedFallbackMetric
    ? `- 참고: 요청 지표 원천 데이터가 없어 ${peak.sourceLabel}을 대체 지표로 사용했습니다.`
    : null;

  return [
    `지난 ${peak.windowHours}시간 기준 ${peak.sourceLabel} 최고 시간대는 ${peak.dateLabel} ${peak.timeLabel}입니다.`,
    '',
    `- 기준: monitoring OTel 슬롯의 서버별 ${peak.sourceLabel} 최대값`,
    `- 최고값: ${formatMetricValue(peak.value, peak.unit)}`,
    `- 상위 평균: ${formatMetricValue(peak.averageTopValue, peak.unit)}`,
    fallbackNotice,
    '',
    '상위 서버',
    topServers,
    '',
    '운영 해석: 이 시간대는 관측 창 안에서 순간 피크가 가장 컸던 구간입니다. 같은 계층의 서버가 함께 높다면 배치, 트래픽 집중, 또는 upstream 병목을 우선 확인하는 것이 좋습니다.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function buildPeakMetricPrompt(peak: PeakMetricSlot): string {
  const topServers = peak.topServers
    .map((server) => `${server.id}=${formatMetricValue(server.value, peak.unit)}`)
    .join(', ');
  const fallbackNotice = peak.usedFallbackMetric
    ? ` 요청 지표의 원천 데이터가 없어 ${peak.sourceLabel}을 대체 지표로 사용했다는 점을 명시하세요.`
    : '';

  return [
    '[결정적 monitoring 피크 지표 근거]',
    `질문은 지난 ${peak.windowHours}시간의 ${peak.sourceLabel} 최고 시간대를 묻고 있습니다.`,
    `최고 시간대: ${peak.dateLabel} ${peak.timeLabel} (${peak.fullTimestamp})`,
    `최고값: ${formatMetricValue(peak.value, peak.unit)}`,
    `상위 평균: ${formatMetricValue(peak.averageTopValue, peak.unit)}`,
    `상위 서버: ${topServers}`,
    '위 수치와 시간대를 바꾸지 말고, 첫 문장에 결론을 답하세요.',
    `그 다음 1-2문장으로 운영 관점 해석을 덧붙이세요.${fallbackNotice}`,
  ].join('\n');
}

function parsePeakMetricRequest(
  request: DomainEvidenceRequest
): ParsedPeakMetricRequest | null {
  if (request.intentFrame) {
    return parseMonitoringPeakMetricFrame(request);
  }

  return parseMonitoringPeakMetricMessage(request.message);
}

export const monitoringPeakMetricEvidenceProvider: DomainEvidenceProvider = {
  id: 'monitoring-peak-metric',
  canHandle(request: DomainEvidenceRequest): boolean {
    return parsePeakMetricRequest(request) !== null;
  },
  async resolve(request: DomainEvidenceRequest) {
    const parsed = parsePeakMetricRequest(request);
    if (!parsed) return null;

    const peak = getMonitoringPeakMetric(parsed);
    if (!peak) return null;

    return {
      id: 'monitoring-peak-metric',
      prompt: buildPeakMetricPrompt(peak),
      fallback: buildPeakMetricFallbackAnswer(peak),
      metadata: {
        metric: peak.requestedMetric,
        sourceMetric: peak.sourceKey,
        windowHours: peak.windowHours,
        slotIndex: peak.slotIndex,
        timestamp: peak.fullTimestamp,
        ...(parsed.capabilityId && { capabilityId: parsed.capabilityId }),
        ...(parsed.intent && { intent: parsed.intent }),
      },
    };
  },
};
