export type AIRateLimitSource =
  | 'frontend-gateway'
  | 'cloud-run-ai'
  | 'upstream-provider'
  | 'unknown';

export type AIRateLimitScope = 'minute' | 'daily' | 'unknown';

export interface AIRateLimitErrorDetails {
  kind: 'rate-limit';
  message: string;
  source: AIRateLimitSource;
  scope: AIRateLimitScope;
  retryAfterSeconds?: number;
  remaining?: number;
  resetAt?: number;
  dailyLimitExceeded?: boolean;
}

export interface AIGenericErrorDetails {
  kind: 'general';
  message: string;
}

export type AIErrorDetails = AIRateLimitErrorDetails | AIGenericErrorDetails;

interface BuildRateLimitErrorDetailsOptions {
  body?: unknown;
  headers?: Headers;
  fallbackSource?: AIRateLimitSource;
}

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  '요청 제한',
  '요청이 너무 많',
  '일일 요청 제한',
  '오늘 한도',
];

const UPSTREAM_PROVIDER_KEYWORDS = [
  'provider',
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'mistral',
  'cerebras',
  'openrouter',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractAIErrorDetailsFromPayload(
  payload: unknown
): AIErrorDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.kind === 'general' && typeof payload.message === 'string') {
    return {
      kind: 'general',
      message: payload.message,
    };
  }

  const message =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : null;

  const looksRateLimited =
    RATE_LIMIT_PATTERNS.some((pattern) =>
      (message ?? '').toLowerCase().includes(pattern)
    ) ||
    normalizeInteger(payload.retryAfter) !== undefined ||
    normalizeInteger(payload.resetAt) !== undefined ||
    normalizeInteger(payload.remaining) !== undefined ||
    isRateLimitSource(payload.source) ||
    isRateLimitScope(payload.limitScope) ||
    payload.dailyLimitExceeded === true ||
    payload.kind === 'rate-limit';

  if (looksRateLimited) {
    return buildRateLimitErrorDetails({
      body: payload,
      fallbackSource:
        message != null ? inferRateLimitSourceFromMessage(message) : 'unknown',
    });
  }

  if (message) {
    return {
      kind: 'general',
      message,
    };
  }

  return null;
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return undefined;
}

function isRateLimitSource(value: unknown): value is AIRateLimitSource {
  return (
    value === 'frontend-gateway' ||
    value === 'cloud-run-ai' ||
    value === 'upstream-provider' ||
    value === 'unknown'
  );
}

function isRateLimitScope(value: unknown): value is AIRateLimitScope {
  return value === 'minute' || value === 'daily' || value === 'unknown';
}

function defaultRateLimitMessage(
  scope: AIRateLimitScope,
  retryAfterSeconds?: number
): string {
  if (scope === 'daily') {
    return '오늘 AI 요청 한도가 소진되었습니다. 내일 다시 시도해주세요.';
  }

  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    return `요청이 너무 많습니다. ${retryAfterSeconds}초 후 다시 시도해주세요.`;
  }

  return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
}

function parseEnvelope(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function inferRateLimitSourceFromMessage(
  message: string,
  fallback: AIRateLimitSource = 'unknown'
): AIRateLimitSource {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cloud run') ||
    normalized.includes('cloud-run') ||
    normalized.includes('ai 엔진')
  ) {
    return 'cloud-run-ai';
  }

  if (
    UPSTREAM_PROVIDER_KEYWORDS.some((keyword) => normalized.includes(keyword))
  ) {
    return 'upstream-provider';
  }

  if (
    normalized.includes('gateway') ||
    normalized.includes('frontend') ||
    normalized.includes('api route')
  ) {
    return 'frontend-gateway';
  }

  return fallback;
}

export function buildRateLimitErrorDetails(
  options: BuildRateLimitErrorDetailsOptions = {}
): AIRateLimitErrorDetails {
  const { body, headers, fallbackSource = 'unknown' } = options;
  const payload = isRecord(body) ? body : {};
  const dailyRemaining = normalizeInteger(
    headers?.get('X-RateLimit-Daily-Remaining')
  );
  const dailyResetAt = normalizeInteger(
    headers?.get('X-RateLimit-Daily-Reset')
  );
  const retryAfterSeconds =
    normalizeInteger(payload.retryAfterSeconds) ??
    normalizeInteger(payload.retryAfter) ??
    normalizeInteger(headers?.get('Retry-After'));
  const remaining =
    normalizeInteger(payload.remaining) ??
    (dailyRemaining !== undefined ? dailyRemaining : undefined) ??
    normalizeInteger(headers?.get('X-RateLimit-Remaining'));
  const resetAt =
    normalizeInteger(payload.resetAt) ??
    (dailyResetAt !== undefined ? dailyResetAt : undefined) ??
    normalizeInteger(headers?.get('X-RateLimit-Reset'));
  const dailyLimitExceeded =
    payload.dailyLimitExceeded === true ||
    (dailyRemaining !== undefined && dailyRemaining <= 0);
  const scope = isRateLimitScope(payload.scope)
    ? payload.scope
    : isRateLimitScope(payload.limitScope)
      ? payload.limitScope
      : dailyLimitExceeded
        ? 'daily'
        : 'minute';
  const source = isRateLimitSource(payload.source)
    ? payload.source
    : fallbackSource;
  const message =
    typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message
      : typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error
        : defaultRateLimitMessage(scope, retryAfterSeconds);

  return {
    kind: 'rate-limit',
    message,
    source,
    scope,
    retryAfterSeconds,
    remaining,
    resetAt,
    dailyLimitExceeded,
  };
}

export function inferAIErrorDetailsFromMessage(
  errorMessage: string
): AIErrorDetails | null {
  if (!errorMessage?.trim()) {
    return null;
  }

  const normalizedMessage = errorMessage
    .replace(/^Failed to start query:\s*/i, '')
    .replace(/^Retry failed:\s*/i, '')
    .trim();
  const envelope = parseEnvelope(normalizedMessage);

  if (envelope) {
    const details = extractAIErrorDetailsFromPayload(envelope);
    if (details?.kind === 'rate-limit') {
      return details;
    }
  }

  const looksRateLimited = RATE_LIMIT_PATTERNS.some((pattern) =>
    normalizedMessage.toLowerCase().includes(pattern)
  );
  if (!looksRateLimited) {
    return null;
  }

  const retryAfterMatch = normalizedMessage.match(/(\d+)\s*초\s*후/);
  const dailyLimitExceeded =
    normalizedMessage.includes('일일') ||
    normalizedMessage.includes('내일 다시');
  const scope: AIRateLimitScope = dailyLimitExceeded ? 'daily' : 'minute';

  return {
    kind: 'rate-limit',
    message: normalizedMessage,
    source: inferRateLimitSourceFromMessage(normalizedMessage),
    scope,
    retryAfterSeconds: retryAfterMatch?.[1]
      ? Number.parseInt(retryAfterMatch[1], 10)
      : undefined,
    dailyLimitExceeded,
  };
}

export function getRateLimitSourceLabel(source: AIRateLimitSource): string {
  switch (source) {
    case 'frontend-gateway':
      return 'frontend gateway';
    case 'cloud-run-ai':
      return 'Cloud Run AI';
    case 'upstream-provider':
      return 'upstream provider';
    default:
      return 'unknown';
  }
}

export function getRateLimitScopeLabel(scope: AIRateLimitScope): string {
  switch (scope) {
    case 'daily':
      return '오늘 한도';
    case 'minute':
      return '분당 한도';
    default:
      return '요청 제한';
  }
}
