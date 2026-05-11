import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
} from '../../core/assistant-runtime';
import { getMonitoringPeakMetric, type PeakMetricSlot } from './peak-metric';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
} from './constants';

interface ParsedPeakMetricRequest {
  metric: string;
  windowHours: number;
  capabilityId?: string;
  intent?: string;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function formatMetricValue(value: number, unit = ''): string {
  return `${formatNumber(value)}${unit}`;
}

const PEAK_PATTERN = /가장|최고|최대|피크|높|high|peak|max/i;
const TIME_QUESTION_PATTERN = /언제|시간대|시각|몇\s*시|when|time/i;
const TIME_WINDOW_PATTERN =
  /24\s*시간|\b24\s*h(?:ours?)?\b|하루|최근|지난|last\s*24/i;
const HOURS_PATTERN = /(\d{1,2})\s*(?:시간|h|hr|hour)s?/i;
const METRIC_PATTERNS: Array<{ metric: string; pattern: RegExp }> = [
  { metric: 'load', pattern: /부하|로드|\bload(?:1|5)?\b/i },
  { metric: 'cpu', pattern: /\bcpu\b|씨피유/i },
  { metric: 'memory', pattern: /메모리|\bmem\b|\bmemory\b/i },
  { metric: 'disk', pattern: /디스크|\bdisk\b|스토리지|\bstorage\b/i },
  { metric: 'network', pattern: /네트워크|\bnetwork\b|\bnet\b/i },
];

function parsePeakMetricRequest(
  message: string
): ParsedPeakMetricRequest | null {
  const metric =
    METRIC_PATTERNS.find(({ pattern }) => pattern.test(message))?.metric ??
    null;
  if (
    !metric ||
    !PEAK_PATTERN.test(message) ||
    !TIME_QUESTION_PATTERN.test(message) ||
    !TIME_WINDOW_PATTERN.test(message)
  ) {
    return null;
  }

  const parsedHours = Number(message.match(HOURS_PATTERN)?.[1]);
  return {
    metric,
    windowHours:
      Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24,
  };
}

function normalizeFrameMetric(metric: string | undefined): string | null {
  if (!metric) return null;
  const normalized = metric.toLowerCase();
  if (normalized === 'load1' || normalized === 'load5') return 'load';

  return METRIC_PATTERNS.some((candidate) => candidate.metric === normalized)
    ? normalized
    : null;
}

function parseFrameWindowHours(timeWindow: string | undefined): number {
  if (!timeWindow) return 24;

  const parsedHours = Number(timeWindow.match(HOURS_PATTERN)?.[1]);
  return Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;
}

function isPeakAggregation(aggregation: string | undefined): boolean {
  if (!aggregation) return false;
  return /peak|max|highest|최고|최대|피크/i.test(aggregation);
}

function parsePeakMetricFrame(
  request: DomainEvidenceRequest
): ParsedPeakMetricRequest | null {
  const frame = request.intentFrame;
  if (!frame || frame.domainId !== MONITORING_DOMAIN_ID) return null;

  const capabilityId = request.capability?.id ?? frame.capabilityId;
  if (
    capabilityId !== undefined &&
    capabilityId !== MONITORING_PEAK_METRIC_CAPABILITY_ID
  ) {
    return null;
  }

  if (frame.intent !== 'metric_peak') return null;

  const metric = normalizeFrameMetric(frame.metric);
  if (!metric || !isPeakAggregation(frame.aggregation)) return null;

  return {
    metric,
    windowHours: parseFrameWindowHours(frame.timeWindow),
    capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
    intent: frame.intent,
  };
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

export const monitoringPeakMetricEvidenceProvider: DomainEvidenceProvider = {
  id: 'monitoring-peak-metric',
  canHandle(request: DomainEvidenceRequest): boolean {
    return (
      parsePeakMetricFrame(request) !== null ||
      parsePeakMetricRequest(request.message) !== null
    );
  },
  async resolve(request: DomainEvidenceRequest) {
    const parsed =
      parsePeakMetricFrame(request) ?? parsePeakMetricRequest(request.message);
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
