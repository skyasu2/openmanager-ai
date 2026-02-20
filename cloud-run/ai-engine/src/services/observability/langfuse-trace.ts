import { logger } from '../../lib/logger';
import type {
  GenerationParams,
  LangfuseTrace,
  TraceMetadata,
} from './langfuse-contracts';
import { getLangfuse } from './langfuse-client';
import { createNoOpTrace } from './langfuse-noop';
import { consumeLangfuseQuota, shouldTrackLangfuseEvent } from './langfuse-usage';

export function createSupervisorTrace(metadata: TraceMetadata): LangfuseTrace {
  if (!shouldTrackLangfuseEvent(metadata.sessionId)) {
    return createNoOpTrace();
  }

  const langfuse = getLangfuse();

  const trace = langfuse.trace({
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
  return trace;
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
  if (!consumeLangfuseQuota(1)) {
    return false;
  }

  try {
    const langfuse = getLangfuse();
    langfuse.score({ traceId, name, value });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [Langfuse] scoreByTraceId failed for trace ${traceId}: ${errorMessage}`);
    return false;
  }
}
