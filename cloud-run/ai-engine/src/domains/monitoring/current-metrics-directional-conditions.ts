import type { QueryOperator } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import type { SupportedMetric } from './current-metrics-evidence-request-types';

export interface MetricCondition {
  metric: SupportedMetric;
  operator: QueryOperator;
  threshold: number;
  inferredThreshold?: boolean;
}

const HIGH_THRESHOLD_BY_METRIC: Record<SupportedMetric, number> = {
  cpu: 80,
  memory: 80,
  disk: 80,
  network: 70,
};

const LOW_THRESHOLD_BY_METRIC: Record<SupportedMetric, number> = {
  cpu: 50,
  memory: 50,
  disk: 50,
  network: 30,
};

const METRIC_MENTION_PATTERNS: Array<[SupportedMetric, RegExp]> = [
  ['cpu', /\bcpu\b|씨피유/gi],
  ['memory', /메모리|\bmem\b|\bmemory\b|\bmemori\b|\bmemroy\b/gi],
  ['disk', /디스크|\bdisk\b|스토리지|\bstorage\b/gi],
  ['network', /네트워크|\bnetwork\b|\bnet\b/gi],
];

function detectMetricDirection(
  message: string,
  startIndex: number,
  endIndex: number
): 'high' | 'low' | null {
  const before = message.slice(Math.max(0, startIndex - 14), startIndex);
  const after = message.slice(endIndex, Math.min(message.length, endIndex + 18));
  const lowBefore = /(?:낮은|적은|여유|한가|low|idle)\s*$/i.test(before);
  const highBefore =
    /(?:높은|많은|과다|상승|급증|high|heavy|elevated)\s*$/i.test(
      before
    );
  const lowAfter =
    /^\s*(?:가|는|은|이|도|사용률|사용량)?\s*(?:낮|적|여유|한가|low|idle)/i.test(
      after
    );
  const highAfter =
    /^\s*(?:가|는|은|이|도|사용률|사용량)?\s*(?:높|많|과다|상승|급증|high|heavy|elevated)/i.test(
      after
    );

  if (lowAfter || lowBefore) return 'low';
  if (highAfter || highBefore) return 'high';
  return null;
}

export function extractMetricDirectionalConditions(
  message: string
): MetricCondition[] {
  const mentions: Array<{
    metric: SupportedMetric;
    startIndex: number;
    endIndex: number;
  }> = [];

  for (const [metric, pattern] of METRIC_MENTION_PATTERNS) {
    for (const match of message.matchAll(pattern)) {
      const matchedText = match[0];
      if (match.index === undefined || !matchedText) continue;
      mentions.push({
        metric,
        startIndex: match.index,
        endIndex: match.index + matchedText.length,
      });
    }
  }

  const seenMetrics = new Set<SupportedMetric>();
  return mentions
    .sort((left, right) => left.startIndex - right.startIndex)
    .flatMap((mention): MetricCondition[] => {
      if (seenMetrics.has(mention.metric)) return [];
      seenMetrics.add(mention.metric);

      const direction = detectMetricDirection(
        message,
        mention.startIndex,
        mention.endIndex
      );
      if (!direction) return [];

      return [
        {
          metric: mention.metric,
          operator: direction === 'low' ? '<=' : '>=',
          threshold:
            direction === 'low'
              ? LOW_THRESHOLD_BY_METRIC[mention.metric]
              : HIGH_THRESHOLD_BY_METRIC[mention.metric],
          inferredThreshold: true,
        },
      ];
    });
}
