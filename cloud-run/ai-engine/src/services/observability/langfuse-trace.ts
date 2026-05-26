import { randomBytes } from 'node:crypto';

import type {
  GenerationParams,
  LangfuseTrace,
  TraceMetadata,
} from './langfuse-contracts';
import { getLangfuse, isLangfuseOperational } from './langfuse-client';
import { createNoOpTrace } from './langfuse-noop';
import {
  isLangfuseUsageReady,
  shouldTrackLangfuseEvent,
} from './langfuse-usage';

function recordSupervisorModeScores(
  trace: LangfuseTrace,
  metadata: Pick<
    TraceMetadata,
    | 'requestedMode'
    | 'resolvedMode'
    | 'modeSelectionSource'
    | 'autoSelectedByComplexity'
  >
): void {
  if (metadata.requestedMode) {
    trace.score({
      name: `requested-mode-${metadata.requestedMode}`,
      value: 1,
    });
  }

  if (metadata.resolvedMode) {
    trace.score({
      name: `resolved-mode-${metadata.resolvedMode}`,
      value: 1,
    });
  }

  if (metadata.modeSelectionSource) {
    trace.score({
      name: `mode-source-${metadata.modeSelectionSource}`,
      value: 1,
    });
  }

  if (metadata.requestedMode === 'auto' && metadata.resolvedMode) {
    trace.score({
      name: `auto-resolved-${metadata.resolvedMode}`,
      value: 1,
    });
  }

  if (metadata.autoSelectedByComplexity) {
    trace.score({
      name: `complexity-selected-${metadata.autoSelectedByComplexity}`,
      value: 1,
    });
  }
}

function generateLangfuseTraceId(): string {
  return randomBytes(16).toString('hex');
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
      ...(metadata.requestedMode && {
        requestedMode: metadata.requestedMode,
      }),
      ...(metadata.resolvedMode && {
        resolvedMode: metadata.resolvedMode,
      }),
      ...(metadata.modeSelectionSource && {
        modeSelectionSource: metadata.modeSelectionSource,
      }),
      ...(metadata.autoSelectedByComplexity && {
        autoSelectedByComplexity: metadata.autoSelectedByComplexity,
      }),
      queryLength: metadata.query.length,
      sampled: true,
      ...(metadata.upstreamTraceId && {
        upstreamTraceId: metadata.upstreamTraceId,
      }),
    },
    input: metadata.query,
  });

  recordSupervisorModeScores(trace, metadata);

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
