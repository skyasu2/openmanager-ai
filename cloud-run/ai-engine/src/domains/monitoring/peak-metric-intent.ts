import type {
  AssistantRequestContext,
  DomainEvidenceRequest,
  DomainIntentFrame,
} from '../../core/assistant-runtime';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
} from './constants';
import type { PeakMetric } from './peak-metric';

export interface ParsedPeakMetricRequest {
  metric: PeakMetric;
  windowHours: number;
  capabilityId?: string;
  intent?: string;
}

const DEFAULT_PEAK_WINDOW_HOURS = 24;

const EXTREME_OR_PEAK_PATTERN =
  /가장|제일|최고|최대|피크|최고점|최댓값|높|힘들(?:었|었던|었나|었어|었냐|던)?|튀(?:는|었|었다|었던|었는|었냐|었어|었고|ㄴ|었나)?|튄|스파이크|spike|버거(?:운|웠|웠던|웠나|웠어)|부담|압박|몰린|집중|high|highest|peak|max/i;
const TEMPORAL_OR_RANKING_FOCUS_PATTERN =
  /언제|(?:^|[^\d])시간(?:대|은|이|을|를)?|시각|시점|몇\s*시|때|구간|순간|\btimestamp\b|\bwhen\b|\btime\b|top\s*server|상위\s*서버|주범\s*서버|영향.*서버|어떤\s*서버/i;
const TIME_WINDOW_PATTERN =
  /24\s*시간|\b24\s*h(?:ours?)?\b|하루|최근|지난|last\s*24|last\s*day|past\s*day/i;
const HOURS_PATTERN = /(\d{1,2})\s*(?:시간|h|hr|hour)s?/i;
const METRIC_PATTERNS: Array<{ metric: PeakMetric; pattern: RegExp }> = [
  {
    metric: 'load',
    pattern:
      /부하|로드|시스템\s*(?:load|pressure)|system\s*(?:load|pressure)|load\s*(?:average|avg)|\bload(?:1|5)?\b|node_load[15]\b/i,
  },
  { metric: 'cpu', pattern: /\bcpu\b|씨피유/i },
  { metric: 'memory', pattern: /메모리|\bmem\b|\bmemory\b/i },
  { metric: 'disk', pattern: /디스크|\bdisk\b|스토리지|\bstorage\b/i },
  { metric: 'network', pattern: /네트워크|\bnetwork\b|\bnet\b/i },
];

function parseWindowHours(message: string): number {
  const parsedHours = Number(message.match(HOURS_PATTERN)?.[1]);
  return Number.isFinite(parsedHours) && parsedHours > 0
    ? parsedHours
    : DEFAULT_PEAK_WINDOW_HOURS;
}

export function parseMonitoringPeakMetricMessage(
  message: string
): ParsedPeakMetricRequest | null {
  const metric =
    METRIC_PATTERNS.find(({ pattern }) => pattern.test(message))?.metric ??
    null;
  if (
    !metric ||
    !EXTREME_OR_PEAK_PATTERN.test(message) ||
    !TEMPORAL_OR_RANKING_FOCUS_PATTERN.test(message) ||
    !TIME_WINDOW_PATTERN.test(message)
  ) {
    return null;
  }

  return {
    metric,
    windowHours: parseWindowHours(message),
  };
}

export function parseMonitoringPeakMetricIntent(
  context: AssistantRequestContext
): DomainIntentFrame | undefined {
  const parsed = parseMonitoringPeakMetricMessage(context.message);
  if (!parsed) return undefined;

  return {
    domainId: MONITORING_DOMAIN_ID,
    intent: 'metric_peak',
    capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
    scope: 'whole_fleet',
    targets: [],
    metric: parsed.metric,
    timeWindow: `${parsed.windowHours}h`,
    aggregation: 'peak',
    topN: 3,
    ambiguity: 'low',
    confidence: 0.9,
  };
}

function normalizeFrameMetric(metric: string | undefined): PeakMetric | null {
  if (!metric) return null;
  const normalized = metric.toLowerCase();
  if (normalized === 'load1' || normalized === 'load5') return 'load';

  return METRIC_PATTERNS.some((candidate) => candidate.metric === normalized)
    ? (normalized as PeakMetric)
    : null;
}

function parseFrameWindowHours(timeWindow: string | undefined): number {
  if (!timeWindow) return DEFAULT_PEAK_WINDOW_HOURS;

  const parsedHours = Number(timeWindow.match(HOURS_PATTERN)?.[1]);
  return Number.isFinite(parsedHours) && parsedHours > 0
    ? parsedHours
    : DEFAULT_PEAK_WINDOW_HOURS;
}

function isPeakAggregation(aggregation: string | undefined): boolean {
  if (!aggregation) return false;
  return /peak|max|highest|최고|최대|피크/i.test(aggregation);
}

export function parseMonitoringPeakMetricFrame(
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
