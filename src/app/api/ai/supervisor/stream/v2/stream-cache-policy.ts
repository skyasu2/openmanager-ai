import {
  type AIEndpoint,
  type CacheableAIResponse,
  setAICache,
} from '@/lib/ai/cache/ai-response-cache';
import { logger } from '@/lib/logging';
import { isStatusQuery, shouldSkipCache } from '../../cache-utils';

const STREAM_CACHE_ENDPOINT: AIEndpoint = 'supervisor';
const GENERAL_INTRO_CACHE_ENDPOINT: AIEndpoint = 'supervisor-intro';
const GLOBAL_GENERAL_INTRO_CACHE_SCOPE = 'global:general-intro:v1';
const MAX_STREAM_CACHE_TEXT_CHARS = 32 * 1024;
const GENERAL_INTRO_QUERY_PATTERN =
  /(소개|설명|무엇|뭐야|뭔지|알려줘|what\s+is|explain|introduce|overview)/i;
const OPERATIONAL_QUERY_PATTERN =
  /(서버|시스템|목록|상태|장애|원인|분석|보고서|상관관계|영향|조치|권고|복구|알람|경고|로그|사용률|메트릭|트래픽|server|system|list|metric|cpu|메모리|memory|disk|디스크|load|latency|critical|warning|incident|outage|root\s+cause|report|remediation)/i;
const ASSISTANT_META_QUERY_PATTERN =
  /(너|넌|네가|당신|너희|자기소개|누구|무슨\s*일|뭐\s*할|할\s*수\s*있|어시스턴트|챗봇|이\s*ai|너.*ai|who\s+are\s+you|what\s+can\s+you\s+do|your\s+role|about\s+you|assistant)/i;

type NormalizedStreamMessage = {
  content: string;
  images?: unknown[];
  files?: unknown[];
};

export type StreamCachePolicy = {
  enabled: boolean;
  cacheSessionId: string;
  endpoint: AIEndpoint;
};

function hasStreamAttachments(messages: NormalizedStreamMessage[]): boolean {
  return messages.some(
    (message) =>
      (Array.isArray(message.images) && message.images.length > 0) ||
      (Array.isArray(message.files) && message.files.length > 0)
  );
}

function isGeneralIntroCacheCandidate(query: string): boolean {
  return (
    GENERAL_INTRO_QUERY_PATTERN.test(query) &&
    !OPERATIONAL_QUERY_PATTERN.test(query) &&
    !ASSISTANT_META_QUERY_PATTERN.test(query) &&
    !isStatusQuery(query)
  );
}

export function resolveStreamCachePolicy(params: {
  query: string;
  messageCount: number;
  messages: NormalizedStreamMessage[];
  enableWebSearch?: boolean;
  enableRAG?: boolean;
  internalDisclosureMode: string | null | undefined;
  defaultCacheSessionId: string;
}): StreamCachePolicy {
  const disabledPolicy: StreamCachePolicy = {
    enabled: false,
    cacheSessionId: params.defaultCacheSessionId,
    endpoint: STREAM_CACHE_ENDPOINT,
  };

  if (shouldSkipCache(params.query, params.messageCount)) return disabledPolicy;
  if (params.enableWebSearch || params.enableRAG) return disabledPolicy;
  if (hasStreamAttachments(params.messages)) return disabledPolicy;
  if (!isGeneralIntroCacheCandidate(params.query)) return disabledPolicy;

  if (params.internalDisclosureMode) {
    return {
      enabled: true,
      cacheSessionId: GLOBAL_GENERAL_INTRO_CACHE_SCOPE,
      endpoint: GENERAL_INTRO_CACHE_ENDPOINT,
    };
  }

  return {
    enabled: true,
    cacheSessionId: params.defaultCacheSessionId,
    endpoint: STREAM_CACHE_ENDPOINT,
  };
}

function extractTextDeltaFromStreamEvent(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.type === 'text-delta' && typeof record.delta === 'string') {
    return record.delta;
  }

  if (record.type === 'text' && typeof record.text === 'string') {
    return record.text;
  }

  return null;
}

function isNonCacheableStreamEvent(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.type === 'error') return true;
  if (record.type === 'data-warning') return true;

  if (record.type === 'data-done') {
    const data = record.data as Record<string, unknown> | undefined;
    return data?.success === false || data?.fallback === true;
  }

  return false;
}

async function collectCacheableTextFromStream(
  body: ReadableStream<Uint8Array>
): Promise<string | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const textParts: string[] = [];
  let pending = '';
  let invalidForCache = false;
  let totalChars = 0;

  const consumeFrame = (frame: string) => {
    for (const rawLine of frame.split('\n')) {
      const line = rawLine.trimEnd();
      if (!line.startsWith('data:')) continue;

      const payload = line.slice(5).trimStart();
      if (!payload || payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload) as unknown;
        if (isNonCacheableStreamEvent(parsed)) {
          invalidForCache = true;
          return;
        }

        const delta = extractTextDeltaFromStreamEvent(parsed);
        if (!delta) continue;

        totalChars += delta.length;
        if (totalChars > MAX_STREAM_CACHE_TEXT_CHARS) {
          invalidForCache = true;
          return;
        }
        textParts.push(delta);
      } catch {
        invalidForCache = true;
        return;
      }
    }
  };

  try {
    while (!invalidForCache) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const frames = pending.split('\n\n');
      pending = frames.pop() ?? '';

      for (const frame of frames) {
        consumeFrame(frame);
        if (invalidForCache) break;
      }
    }

    if (!invalidForCache && pending.trim()) {
      consumeFrame(pending);
    }
  } finally {
    if (invalidForCache) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }

  if (invalidForCache) return null;

  const text = textParts.join('').trim();
  return text.length > 0 ? text : null;
}

export function isUpstreamResponseCacheable(response: Response): boolean {
  const fallbackHeader = response.headers.get('X-Fallback-Response');
  const sourceHeader = response.headers.get('X-AI-Source');
  return fallbackHeader !== 'true' && sourceHeader !== 'fallback';
}

export function persistStreamCache(params: {
  body: ReadableStream<Uint8Array>;
  cacheSessionId: string;
  userQuery: string;
  endpoint: AIEndpoint;
}) {
  void collectCacheableTextFromStream(params.body)
    .then((text) => {
      if (!text) return;
      const response: CacheableAIResponse = {
        success: true,
        response: text,
        source: 'cloud-run-stream-v2',
      };
      return setAICache(
        params.cacheSessionId,
        params.userQuery,
        response,
        params.endpoint
      );
    })
    .catch((error) => {
      logger.warn('[SupervisorStreamV2] Stream cache capture failed:', error);
    });
}
