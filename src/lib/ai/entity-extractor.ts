/**
 * LLM Entity Extractor — Groq llama-4-scout-17b 기반
 *
 * 쿼리에서 server_id / metric / time_range 슬롯을 추출하여
 * 불필요한 클래리피케이션을 사전 차단합니다.
 *
 * 모델: Groq llama-4-scout-17b (500K TPD, 무료)
 * 평균 레이턴시: ~200ms (단문 JSON 추출)
 */

export interface ExtractedEntities {
  /** 명시된 서버 ID (예: api-was-dc1-01) */
  server?: string;
  /** 명시된 메트릭 타입 (예: cpu, memory, disk) */
  metric?: string;
  /** 명시된 시간 범위 (예: 1h, 24h, 7d) */
  timeRange?: string;
  /** 추출 신뢰도 0-100 */
  confidence: number;
}

const SYSTEM_PROMPT = `You are an entity extractor for a server monitoring system.
Extract entities from the user query and return ONLY valid JSON.

Known server IDs:
lb-haproxy-dc1-01, lb-haproxy-dc1-02, lb-haproxy-dc1-03,
web-nginx-dc1-01, web-nginx-dc1-02, web-nginx-dc1-03,
api-was-dc1-01, api-was-dc1-02, api-was-dc1-03,
db-mysql-dc1-primary, db-mysql-dc1-replica, db-mysql-dc1-backup,
cache-redis-dc1-01, cache-redis-dc1-02, cache-redis-dc1-03,
storage-nfs-dc1-01, storage-nfs-dc1-02

Output format (JSON only, no explanation):
{
  "server": "<exact server ID or null>",
  "metric": "<cpu|memory|disk|network|null>",
  "timeRange": "<1h|6h|24h|7d|null>",
  "confidence": <0-100>
}`;

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
    return data as ExtractedEntities;
  } catch {
    return { confidence: 0 };
  }
}

export { SYSTEM_PROMPT };
