/**
 * LLM Entity Extractor — Groq llama-4-scout-17b 기반
 *
 * 쿼리에서 server_id / metric / time_range 슬롯을 추출하여
 * 불필요한 클래리피케이션을 사전 차단합니다.
 *
 * 모델: Groq llama-4-scout-17b (500K TPD, 무료)
 * 평균 레이턴시: ~200ms (단문 JSON 추출)
 */

import {
  getRegisteredServerIds,
  type RegisteredServerId,
} from '@/config/server-registry';

export interface ExtractedEntities {
  /** 명시된 서버 ID (예: api-was-dc1-01) */
  server?: KnownEntityServerId;
  /** 명시된 메트릭 타입 (예: cpu, memory, disk) */
  metric?: ExtractedMetric;
  /** 명시된 시간 범위 (예: 1h, 24h, 7d) */
  timeRange?: ExtractedTimeRange;
  /** 추출 신뢰도 0-100 */
  confidence: number;
}

export const ENTITY_CONFIDENCE_THRESHOLD = 80;

export const KNOWN_ENTITY_SERVER_IDS = getRegisteredServerIds() as [
  RegisteredServerId,
  ...RegisteredServerId[],
];

export type KnownEntityServerId = RegisteredServerId;

export const EXTRACTED_METRICS = ['cpu', 'memory', 'disk', 'network'] as const;
export type ExtractedMetric = (typeof EXTRACTED_METRICS)[number];

export const EXTRACTED_TIME_RANGES = ['1h', '6h', '24h', '7d'] as const;
export type ExtractedTimeRange = (typeof EXTRACTED_TIME_RANGES)[number];

const SYSTEM_PROMPT = `You are an entity extractor for a server monitoring system.
Extract entities from the user query and return ONLY valid JSON.

Known server IDs:
${KNOWN_ENTITY_SERVER_IDS.join(', ')}

Output format (JSON only, no explanation):
{
  "server": "<exact server ID or null>",
  "metric": "<cpu|memory|disk|network|null>",
  "timeRange": "<1h|6h|24h|7d|null>",
  "confidence": <0-100>
}`;

function isKnownServerId(value: unknown): value is KnownEntityServerId {
  return (
    typeof value === 'string' &&
    (KNOWN_ENTITY_SERVER_IDS as readonly string[]).includes(value)
  );
}

function isExtractedMetric(value: unknown): value is ExtractedMetric {
  return (
    typeof value === 'string' &&
    (EXTRACTED_METRICS as readonly string[]).includes(value)
  );
}

function isExtractedTimeRange(value: unknown): value is ExtractedTimeRange {
  return (
    typeof value === 'string' &&
    (EXTRACTED_TIME_RANGES as readonly string[]).includes(value)
  );
}

export function normalizeExtractedEntities(data: unknown): ExtractedEntities {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const raw = data as Record<string, unknown>;
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(100, raw.confidence))
      : 0;

  return {
    ...(isKnownServerId(raw.server) ? { server: raw.server } : {}),
    ...(isExtractedMetric(raw.metric) ? { metric: raw.metric } : {}),
    ...(isExtractedTimeRange(raw.timeRange)
      ? { timeRange: raw.timeRange }
      : {}),
    confidence,
  };
}

export async function extractEntities(
  query: string
): Promise<ExtractedEntities> {
  try {
    const res = await fetch('/api/ai/nlq/extract-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return { confidence: 0 };

    const data = await res.json();
    return normalizeExtractedEntities(data);
  } catch {
    return { confidence: 0 };
  }
}

export { SYSTEM_PROMPT };
