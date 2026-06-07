import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

import { getGroqModel } from '../model-provider';

export type RoutingIntentLabel =
  | 'metrics_query'
  | 'advisor'
  | 'analyst'
  | 'reporter'
  | 'general';

export interface RoutingIntentClassification {
  suggestedAgent?: string;
  confidence: number;
}

export interface RoutingIntentClassifierOptions {
  model?: LanguageModel;
  timeoutMs?: number;
}

const CLASSIFIER_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 200;

const routingIntentSchema = z.object({
  agent: z.enum([
    'metrics_query',
    'advisor',
    'analyst',
    'reporter',
    'general',
  ]).describe('Best routing label for the user query'),
  confidence: z.number().min(0).max(1),
});

const AGENT_BY_LABEL: Record<Exclude<RoutingIntentLabel, 'general'>, string> = {
  metrics_query: 'Metrics Query Agent',
  advisor: 'Advisor Agent',
  analyst: 'Analyst Agent',
  reporter: 'Reporter Agent',
};

interface CacheEntry {
  expiresAt: number;
  value: RoutingIntentClassification;
}

const classificationCache = new Map<string, CacheEntry>();

function normalizeCacheKey(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCachedClassification(
  query: string,
  now = Date.now()
): RoutingIntentClassification | null {
  const cached = classificationCache.get(normalizeCacheKey(query));
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    classificationCache.delete(normalizeCacheKey(query));
    return null;
  }

  return cached.value;
}

function setCachedClassification(
  query: string,
  value: RoutingIntentClassification,
  now = Date.now()
): void {
  const key = normalizeCacheKey(query);
  classificationCache.delete(key);
  classificationCache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    value,
  });

  while (classificationCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = classificationCache.keys().next().value;
    if (!oldestKey) break;
    classificationCache.delete(oldestKey);
  }
}

function mapLabelToClassification(
  label: RoutingIntentLabel,
  confidence: number
): RoutingIntentClassification {
  if (label === 'general') {
    return { confidence };
  }

  return {
    suggestedAgent: AGENT_BY_LABEL[label],
    confidence,
  };
}

function buildIntentClassifierPrompt(query: string): string {
  return [
    'Classify the Korean/English user query for OpenManager server monitoring routing.',
    'Return only the structured object requested by the schema.',
    '',
    'Labels:',
    '- metrics_query: server status, current metrics, ranking, threshold/filter, group comparison, multi-metric AND conditions, inverse filter (healthy/normal/no-issue servers), restart-needed server lookup',
    '- advisor: remediation, commands, runbook, operational guidance, optimization advice',
    '- analyst: anomaly detection, root-cause analysis, why questions, trend prediction, rate-of-change analysis, saturation forecasting',
    '- reporter: incident report, timeline, postmortem/report writing',
    '- general: greeting or non-monitoring small talk',
    '',
    'Examples:',
    'Q: 서버 상태 알려줘 -> metrics_query',
    'Q: CPU 높은 서버 TOP5 -> metrics_query',
    'Q: 재시작해야 할 서버 있어? -> metrics_query',
    'Q: DB vs Cache 비교해줘 -> metrics_query',
    'Q: 이상 없는 서버 목록 -> metrics_query',
    'Q: 정상 서버만 보여줘 -> metrics_query',
    'Q: DB 서버와 cache 서버 중 경고 수가 더 많은 쪽은? -> metrics_query',
    'Q: CPU, 메모리, 디스크 모두 50% 미만인 서버 -> metrics_query',
    'Q: 상태 어때? -> metrics_query',
    'Q: 장애 보고서 생성해줘 -> reporter',
    'Q: 인시던트 타임라인 만들어줘 -> reporter',
    'Q: 방금 장애 내용 리포트로 정리해줘 -> reporter',
    'Q: CPU 급증 원인 분석해줘 -> analyst',
    'Q: 왜 응답시간이 느려졌어? -> analyst',
    'Q: 이상 징후 탐지해줘 -> analyst',
    'Q: 어느 서버가 먼저 포화될 것 같아? -> analyst',
    'Q: 메모리 부족 해결 방법 알려줘 -> advisor',
    'Q: nginx 5xx 확인 명령어 알려줘 -> advisor',
    'Q: 온콜 대응 순서 알려줘 -> advisor',
    'Q: 안녕하세요 -> general',
    'Q: 오늘 몇 시야? -> general',
    '',
    `User query: ${query}`,
  ].join('\n');
}

async function runWithTimeout<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  const abortController = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      operation(abortController.signal).catch(() => null),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function clearRoutingIntentClassifierCache(): void {
  classificationCache.clear();
}

export async function classifyRoutingIntentWithLLM(
  query: string,
  options: RoutingIntentClassifierOptions = {}
): Promise<RoutingIntentClassification | null> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const cached = getCachedClassification(normalizedQuery);
  if (cached) return cached;

  const timeoutMs = options.timeoutMs ?? CLASSIFIER_TIMEOUT_MS;

  try {
    const model = options.model ?? getGroqModel();
    const result = await runWithTimeout(
      async (abortSignal) => generateObject({
        model,
        schema: routingIntentSchema,
        schemaName: 'OpenManagerRoutingIntent',
        schemaDescription: 'Intent label and confidence for specialist agent routing',
        prompt: buildIntentClassifierPrompt(normalizedQuery),
        temperature: 0,
        maxOutputTokens: 80,
        maxRetries: 0,
        abortSignal,
      }),
      timeoutMs
    );

    if (!result) return null;

    const classification = mapLabelToClassification(
      result.object.agent,
      result.object.confidence
    );
    setCachedClassification(normalizedQuery, classification);
    return classification;
  } catch {
    return null;
  }
}
