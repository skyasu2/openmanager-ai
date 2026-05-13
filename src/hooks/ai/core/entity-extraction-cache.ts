import {
  ENTITY_CONFIDENCE_THRESHOLD,
  type ExtractedEntities,
  extractEntities,
} from '@/lib/ai/entity-extractor';

const SEMANTIC_METRIC_PATTERN =
  /부하|로드|\bload(?:1|5)?\b|cpu|씨피유|메모리|\bmem(?:ory)?\b|디스크|\bdisk\b|네트워크|\bnet(?:work)?\b|힘들|버거|느린|느려|느리|부담|응답.*느|과부하|리소스|자원/i;
const SEMANTIC_PEAK_PATTERN = /피크|peak|max|최고|최대|높/i;
const SEMANTIC_TIME_WINDOW_PATTERN = /24\s*시간|\b24h\b|최근|지난|last\s*24/i;

export function shouldExtractSemanticIntentFrame(query: string): boolean {
  return (
    SEMANTIC_METRIC_PATTERN.test(query) ||
    (SEMANTIC_PEAK_PATTERN.test(query) &&
      SEMANTIC_TIME_WINDOW_PATTERN.test(query))
  );
}

const ENTITY_EXTRACTION_CACHE_MAX = 30;
const ENTITY_EXTRACTION_CACHE_TTL_MS = 5 * 60 * 1000;

interface EntityExtractionCacheEntry {
  expiresAt: number;
  promise: Promise<ExtractedEntities>;
}

const entityExtractionCache = new Map<string, EntityExtractionCacheEntry>();

function normalizeEntityExtractionCacheKey(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function hasUsefulEntityExtraction(result: ExtractedEntities): boolean {
  if (result.confidence < ENTITY_CONFIDENCE_THRESHOLD) {
    return false;
  }

  return (
    result.server !== undefined ||
    result.metric !== undefined ||
    result.timeRange !== undefined ||
    result.intentFrame !== undefined
  );
}

function pruneEntityExtractionCache(now: number): void {
  for (const [key, entry] of entityExtractionCache) {
    if (entry.expiresAt <= now) {
      entityExtractionCache.delete(key);
    }
  }

  while (entityExtractionCache.size >= ENTITY_EXTRACTION_CACHE_MAX) {
    const firstKey = entityExtractionCache.keys().next().value;
    if (firstKey === undefined) break;
    entityExtractionCache.delete(firstKey);
  }
}

export async function extractEntitiesCached(
  query: string
): Promise<ExtractedEntities> {
  const key = normalizeEntityExtractionCacheKey(query);
  if (!key) return { confidence: 0 };

  const now = Date.now();
  const cached = entityExtractionCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  pruneEntityExtractionCache(now);

  const promise = extractEntities(query).then((result) => {
    if (!hasUsefulEntityExtraction(result)) {
      entityExtractionCache.delete(key);
    }
    return result;
  });

  entityExtractionCache.set(key, {
    expiresAt: now + ENTITY_EXTRACTION_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

export function clearEntityExtractionCacheForTesting(): void {
  if (process.env.NODE_ENV !== 'test') return;
  entityExtractionCache.clear();
}
