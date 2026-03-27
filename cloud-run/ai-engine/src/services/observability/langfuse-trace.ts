import { randomBytes } from 'node:crypto';

import { logger } from '../../lib/logger';
import type {
  GenerationParams,
  LangfuseTrace,
  TraceMetadata,
} from './langfuse-contracts';
import { getLangfuse, isLangfuseOperational } from './langfuse-client';
import { createNoOpTrace } from './langfuse-noop';
import {
  consumeLangfuseQuota,
  isLangfuseUsageReady,
  shouldTrackLangfuseEvent,
} from './langfuse-usage';

const TRACE_ID_HEX_REGEX = /^[0-9a-f]{32}$/;
const INVALID_TRACE_ID = '0'.repeat(32);

function generateLangfuseTraceId(): string {
  return randomBytes(16).toString('hex');
}

function normalizeLangfuseTraceId(traceId?: string | null): string | null {
  if (typeof traceId !== 'string') {
    return null;
  }

  const normalized = traceId.trim().toLowerCase().replace(/-/g, '');
  if (!TRACE_ID_HEX_REGEX.test(normalized) || normalized === INVALID_TRACE_ID) {
    return null;
  }

  return normalized;
}

export function createSupervisorTrace(metadata: TraceMetadata): LangfuseTrace {
  if (!isLangfuseOperational() || !isLangfuseUsageReady()) {
    return createNoOpTrace();
  }

  if (!shouldTrackLangfuseEvent(metadata.sessionId)) {
    return createNoOpTrace();
  }

  const langfuse = getLangfuse();
  const traceId = generateLangfuseTraceId();

  const trace = langfuse.trace({
    id: traceId,
    name: 'supervisor-execution',
    sessionId: metadata.sessionId,
    userId: metadata.userId,
    metadata: {
      mode: metadata.mode,
      queryLength: metadata.query.length,
      sampled: true,
      ...(metadata.upstreamTraceId && {
        upstreamTraceId: metadata.upstreamTraceId,
      }),
    },
    input: metadata.query,
  });

  const traceWithId = trace as LangfuseTrace & { id?: string };
  if (traceWithId.id) {
    return traceWithId;
  }

  traceWithId.id = traceId;
  return traceWithId;
}

export function logGeneration(trace: LangfuseTrace, params: GenerationParams): void {
  trace.generation({
    name: `${params.provider}/${params.model}`,
    model: params.model,
    input: params.input,
    output: params.output,
    usage: params.usage
      ? {
          input: params.usage.inputTokens,
          output: params.usage.outputTokens,
          total: params.usage.totalTokens,
        }
      : undefined,
    metadata: {
      provider: params.provider,
      duration: params.duration,
      ...params.metadata,
    },
  });
}

export function logToolCall(
  trace: LangfuseTrace,
  toolName: string,
  input: unknown,
  output: unknown,
  durationMs: number
): void {
  trace.span({
    name: `tool:${toolName}`,
    input: input as object,
    output: output as object,
    metadata: {
      durationMs,
      toolName,
    },
  });
}

export function logHandoff(
  trace: LangfuseTrace,
  fromAgent: string,
  toAgent: string,
  reason?: string
): void {
  trace.event({
    name: 'agent-handoff',
    metadata: {
      from: fromAgent,
      to: toAgent,
      reason,
    },
  });
}

export function finalizeTrace(
  trace: LangfuseTrace,
  output: string,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  trace.update({
    output,
    metadata: {
      success,
      ...metadata,
    },
  });

  if (success) {
    trace.score({
      name: 'execution-success',
      value: 1,
    });
  }
}

export function scoreByTraceId(traceId: string, name: string, value: number): boolean {
  if (!isLangfuseOperational() || !isLangfuseUsageReady()) {
    return false;
  }

  const normalizedTraceId = normalizeLangfuseTraceId(traceId);
  if (!normalizedTraceId) {
    return false;
  }

  if (!consumeLangfuseQuota(1)) {
    return false;
  }

  try {
    const langfuse = getLangfuse();
    langfuse.score({ traceId: normalizedTraceId, name, value });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `❌ [Langfuse] scoreByTraceId failed for trace ${normalizedTraceId}: ${errorMessage}`
    );
    return false;
  }
}
