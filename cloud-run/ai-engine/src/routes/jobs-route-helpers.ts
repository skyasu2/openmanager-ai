type JobStreamHandoff = { from: string; to: string; reason?: string };

type JobProgressMetadata = {
  agent?: string;
  handoffFrom?: string;
  handoffTo?: string;
  executionPath?: string[];
  handoffCount?: number;
  stageLabel?: string;
  stageDetail?: string;
};

type JobErrorDetails = {
  kind: 'rate-limit' | 'general';
  message: string;
  source?: 'frontend-gateway' | 'cloud-run-ai' | 'upstream-provider' | 'unknown';
  scope?: 'minute' | 'daily' | 'unknown';
  retryAfterSeconds?: number;
  remaining?: number;
  resetAt?: number;
  dailyLimitExceeded?: boolean;
};

const AGENT_STAGE_MAP: Record<string, string> = {
  Orchestrator: 'routing',
  supervisor: 'routing',
  'NLQ Agent': 'nlq',
  nlq: 'nlq',
  'Analyst Agent': 'analyst',
  analyst: 'analyst',
  'Reporter Agent': 'reporter',
  reporter: 'reporter',
  'Advisor Agent': 'processing',
  advisor: 'processing',
  'Vision Agent': 'processing',
  vision: 'processing',
};

const AGENT_ROLE_LABELS: Record<string, string> = {
  Orchestrator: '분석 조율',
  supervisor: '분석 조율',
  'NLQ Agent': '자연어 분석',
  nlq: '자연어 분석',
  'Analyst Agent': '심층 분석',
  analyst: '심층 분석',
  'Reporter Agent': '보고서 생성',
  reporter: '보고서 생성',
  'Advisor Agent': '운영 어드바이저',
  advisor: '운영 어드바이저',
  'Vision Agent': '시각 분석',
  vision: '시각 분석',
};

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  'too many',
  'quota',
  '요청 제한',
  '요청이 너무 많',
  '일일 요청 제한',
  '오늘 한도',
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNumberValue(value: unknown): number | undefined {
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

function isRateLimitSource(
  value: unknown
): value is NonNullable<JobErrorDetails['source']> {
  return (
    value === 'frontend-gateway' ||
    value === 'cloud-run-ai' ||
    value === 'upstream-provider' ||
    value === 'unknown'
  );
}

function isRateLimitScope(
  value: unknown
): value is NonNullable<JobErrorDetails['scope']> {
  return value === 'minute' || value === 'daily' || value === 'unknown';
}

function inferRateLimitSourceFromMessage(
  message: string
): NonNullable<JobErrorDetails['source']> {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cloud run') ||
    normalized.includes('cloud-run') ||
    normalized.includes('ai 엔진')
  ) {
    return 'cloud-run-ai';
  }

  if (
    normalized.includes('provider') ||
    normalized.includes('openai') ||
    normalized.includes('anthropic') ||
    normalized.includes('gemini')
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

  return 'unknown';
}

export function getAgentLabel(agent: string): string {
  return AGENT_ROLE_LABELS[agent] ?? agent;
}

function buildStageDetail(
  path: string[],
  handoff?: JobStreamHandoff
): string | undefined {
  if (handoff) {
    return `${getAgentLabel(handoff.from)} → ${getAgentLabel(handoff.to)}`;
  }

  if (path.length === 0) {
    return undefined;
  }

  return path.map(getAgentLabel).join(' → ');
}

export function normalizeJobErrorDetails(
  value: unknown
): JobErrorDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.kind === 'general' && typeof value.message === 'string') {
    return {
      kind: 'general',
      message: value.message,
    };
  }

  const message =
    getStringValue(value.message) ?? getStringValue(value.error) ?? undefined;
  const retryAfterSeconds =
    getNumberValue(value.retryAfterSeconds) ?? getNumberValue(value.retryAfter);
  const remaining = getNumberValue(value.remaining);
  const resetAt = getNumberValue(value.resetAt);
  const dailyLimitExceeded = value.dailyLimitExceeded === true;
  const scope = isRateLimitScope(value.scope)
    ? value.scope
    : isRateLimitScope(value.limitScope)
      ? value.limitScope
      : dailyLimitExceeded
        ? 'daily'
        : undefined;
  const source = isRateLimitSource(value.source) ? value.source : undefined;

  const looksRateLimited =
    value.kind === 'rate-limit' ||
    RATE_LIMIT_PATTERNS.some((pattern) =>
      (message ?? '').toLowerCase().includes(pattern)
    ) ||
    retryAfterSeconds !== undefined ||
    remaining !== undefined ||
    resetAt !== undefined ||
    source !== undefined ||
    scope !== undefined ||
    dailyLimitExceeded;

  if (looksRateLimited) {
    return {
      kind: 'rate-limit',
      message:
        message ??
        (dailyLimitExceeded
          ? '오늘 AI 요청 한도가 소진되었습니다. 내일 다시 시도해주세요.'
          : retryAfterSeconds
            ? `요청이 너무 많습니다. ${retryAfterSeconds}초 후 다시 시도해주세요.`
            : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'),
      ...(source && { source }),
      ...(scope && { scope }),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(remaining !== undefined && { remaining }),
      ...(resetAt !== undefined && { resetAt }),
      ...(dailyLimitExceeded && { dailyLimitExceeded }),
    };
  }

  if (message) {
    return {
      kind: 'general',
      message,
    };
  }

  return undefined;
}

export function extractJobErrorDetails(
  error: unknown,
  publicMessage: string
): JobErrorDetails | undefined {
  if (isRecord(error) && 'details' in error) {
    const details = normalizeJobErrorDetails(error.details);
    if (details) {
      return details.kind === 'rate-limit'
        ? details
        : { kind: 'general', message: publicMessage };
    }
  }

  const payloadDetails = normalizeJobErrorDetails(error);
  if (payloadDetails?.kind === 'rate-limit') {
    return payloadDetails;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : isRecord(error)
        ? getStringValue(error.message) ?? getStringValue(error.error)
        : undefined;

  const looksRateLimited =
    rawMessage != null &&
    RATE_LIMIT_PATTERNS.some((pattern) =>
      rawMessage.toLowerCase().includes(pattern)
    );

  if (looksRateLimited && rawMessage) {
    const errorRecord = isRecord(error) ? error : null;
    const retryAfterSeconds = getNumberValue(
      errorRecord ? errorRecord.retryAfterSeconds ?? errorRecord.retryAfter : undefined
    );
    const remaining = getNumberValue(errorRecord ? errorRecord.remaining : undefined);
    const resetAt = getNumberValue(errorRecord ? errorRecord.resetAt : undefined);
    const scope = isRateLimitScope(errorRecord ? errorRecord.scope : undefined)
      ? (errorRecord?.scope as NonNullable<JobErrorDetails['scope']>)
      : undefined;

    return {
      kind: 'rate-limit',
      message: rawMessage,
      source: inferRateLimitSourceFromMessage(rawMessage),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(remaining !== undefined && { remaining }),
      ...(resetAt !== undefined && { resetAt }),
      ...(scope && { scope }),
    };
  }

  return {
    kind: 'general',
    message: publicMessage,
  };
}

export function resolveAgentStage(agent?: string): string {
  if (!agent) return 'processing';
  return AGENT_STAGE_MAP[agent] ?? 'processing';
}

export function appendExecutionPath(
  path: string[],
  ...agents: Array<string | undefined>
) {
  for (const agent of agents) {
    if (!agent) continue;
    if (path[path.length - 1] !== agent) {
      path.push(agent);
    }
  }
}

export function buildProgressMetadata({
  executionPath,
  handoffs,
  agent,
  handoff,
}: {
  executionPath: string[];
  handoffs: JobStreamHandoff[];
  agent?: string;
  handoff?: JobStreamHandoff;
}): JobProgressMetadata {
  return {
    ...(agent && { agent }),
    ...(handoff && {
      handoffFrom: handoff.from,
      handoffTo: handoff.to,
    }),
    ...(executionPath.length > 0 && { executionPath: [...executionPath] }),
    ...(handoffs.length > 0 && { handoffCount: handoffs.length }),
    ...(agent && { stageLabel: getAgentLabel(agent) }),
    ...(buildStageDetail(executionPath, handoff) && {
      stageDetail: buildStageDetail(executionPath, handoff),
    }),
  };
}

export function parseHandoffEvent(value: unknown): JobStreamHandoff | null {
  if (!isRecord(value)) return null;
  const from = getStringValue(value.from);
  const to = getStringValue(value.to);
  if (!from || !to) return null;
  return {
    from,
    to,
    ...(getStringValue(value.reason) && { reason: getStringValue(value.reason) }),
  };
}

export function parseAgentStatusEvent(
  value: unknown
): { agent: string; status?: string; message?: string } | null {
  if (!isRecord(value)) return null;
  const agent = getStringValue(value.agent);
  if (!agent) return null;
  return {
    agent,
    ...(getStringValue(value.status) && { status: getStringValue(value.status) }),
    ...(getStringValue(value.message) && { message: getStringValue(value.message) }),
  };
}

export type { JobErrorDetails, JobProgressMetadata, JobStreamHandoff };

export const STAGE_PROGRESS_MAP: Record<string, number> = {
  initializing: 10,
  routing: 20,
  nlq: 40,
  analyst: 60,
  processing: 60,
  reporter: 80,
  finalizing: 90,
  completed: 100,
};
