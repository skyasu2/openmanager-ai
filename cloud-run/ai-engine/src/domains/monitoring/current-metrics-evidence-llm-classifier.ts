import { generateObject } from 'ai';
import { z } from 'zod';
import { selectRoundRobinProviderOrder } from '../../services/ai-sdk/agents/config/round-robin-provider-selector';
import { selectTextModel } from '../../services/ai-sdk/agents/config/agent-model-selectors';
import type { ParsedCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request-types';
import {
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';

const CLASSIFIER_TIMEOUT_MS = 2_000;

const evidenceIntentSchema = z.object({
  intent: z
    .enum(['server_health', 'metric_ranking', 'metric_current', 'metric_trend', 'none'])
    .describe('Evidence routing intent for the query'),
  statusFilter: z
    .enum(['healthy-only', 'warning', 'critical', 'none'])
    .optional()
    .describe('Status filter when intent is server_health'),
  confidence: z.number().min(0).max(1),
});

const CAPABILITY_BY_INTENT: Record<
  Exclude<z.infer<typeof evidenceIntentSchema>['intent'], 'none'>,
  string
> = {
  server_health: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
  metric_ranking: MONITORING_METRIC_RANKING_CAPABILITY_ID,
  metric_current: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  metric_trend: MONITORING_METRIC_TREND_CAPABILITY_ID,
};

function buildEvidenceClassifierPrompt(message: string): string {
  return [
    'Classify this Korean/English server monitoring query to select the right evidence handler.',
    '',
    'Intent labels:',
    '- server_health: server status overview, listing healthy/warning/critical/all servers, group health comparison',
    '- metric_ranking: ranking servers by a metric (CPU top N, memory highest, disk lowest), finding most/least loaded',
    '- metric_current: current value of a specific metric for one or more servers, threshold filter (>50%), AND conditions',
    '- metric_trend: rate of change, trend over time, which server is growing fastest',
    '- none: unclear or not a monitoring evidence query',
    '',
    'statusFilter (only for server_health):',
    '- healthy-only: asking for normal/healthy/no-issue servers',
    '- warning-only: asking for servers in warning state',
    '- none: all servers or unspecified',
    '',
    'Examples:',
    'Q: 건강한 서버 TOP3 → server_health, healthy-only',
    'Q: 정상 서버 목록 → server_health, healthy-only',
    'Q: 이상 없는 서버 → server_health, healthy-only',
    'Q: 안정적인 서버 상위 3개 → server_health, healthy-only',
    'Q: 경고 상태 서버 보여줘 → server_health, warning',
    'Q: 전체 서버 상태 요약 → server_health, none',
    'Q: CPU 높은 서버 TOP5 → metric_ranking',
    'Q: 메모리 가장 낮은 서버는? → metric_ranking',
    'Q: CPU, 메모리, 디스크 모두 50% 미만인 서버 → metric_current',
    'Q: db-mysql-dc1-primary CPU 얼마야? → metric_current',
    'Q: 디스크 증가율 빠른 서버 → metric_trend',
    '',
    `Query: ${message}`,
  ].join('\n');
}

async function runWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  const controller = new AbortController();
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    handle = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(controller.signal).catch(() => null), timeout]);
  } finally {
    if (handle !== undefined) clearTimeout(handle);
  }
}

/**
 * LLM fallback for evidence intent classification.
 * Called only when regex-based parsing returns null.
 * Uses round-robin provider selection with 2s timeout.
 */
export async function classifyEvidenceIntentWithLLM(
  message: string,
): Promise<ParsedCurrentMetricsEvidenceRequest | null> {
  const { providerOrder, rotationSlot } = selectRoundRobinProviderOrder(4_000);
  const model = selectTextModel('EvidenceClassifier', providerOrder, {
    cbPrefix: 'llm-evidence-classifier',
    requiredCapabilities: { requireStructuredOutput: true },
    rotationSlot,
  });
  if (!model) return null;

  const result = await runWithTimeout(async (signal) => {
    const res = await generateObject({
      model: model.model,
      schema: evidenceIntentSchema,
      schemaName: 'MonitoringEvidenceIntent',
      schemaDescription: 'Intent label for monitoring evidence handler selection',
      prompt: buildEvidenceClassifierPrompt(message),
      temperature: 0,
      maxOutputTokens: 60,
      maxRetries: 0,
      abortSignal: signal,
    });
    return res.object;
  }, CLASSIFIER_TIMEOUT_MS);

  if (!result || result.intent === 'none' || result.confidence < 0.7) return null;

  const capabilityId = CAPABILITY_BY_INTENT[result.intent];

  if (result.intent === 'server_health') {
    const sf = result.statusFilter;
    return {
      intent: 'server_health',
      capabilityId,
      sourceIntent: 'llm-classified',
      answerQuery: message,
      ...(sf === 'healthy-only'
        ? { statusFilter: 'healthy-only' as const }
        : sf === 'warning'
          ? { statusFilter: 'warning' as const }
          : sf === 'critical'
            ? { statusFilter: 'critical' as const }
            : {}),
    };
  }

  if (result.intent === 'metric_ranking') {
    return {
      intent: 'metric_ranking',
      capabilityId,
      sourceIntent: 'llm-classified',
      answerQuery: message,
    };
  }

  if (result.intent === 'metric_current') {
    return {
      intent: 'metric_current',
      capabilityId,
      sourceIntent: 'llm-classified',
      answerQuery: message,
    };
  }

  if (result.intent === 'metric_trend') {
    return {
      intent: 'metric_trend',
      capabilityId,
      sourceIntent: 'llm-classified',
      answerQuery: message,
    };
  }

  return null;
}
