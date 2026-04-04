import type { SupervisorResponse } from './supervisor-types';

export interface SupervisorDegradedFallbackContext {
  degradedFromMode: 'multi';
  degradedReason: 'multi_agent_model_unavailable' | 'multi_agent_runtime_error';
}

export function shouldFallbackFromMultiAgentError(code?: string): boolean {
  return code === 'MODEL_UNAVAILABLE';
}

export function hasMeaningfulMultiAgentOutput(eventType: string): boolean {
  return (
    eventType === 'text_delta' ||
    eventType === 'tool_call' ||
    eventType === 'tool_result' ||
    eventType === 'handoff' ||
    eventType === 'done'
  );
}

export function buildDegradedMetadata<T extends Record<string, unknown>>(
  context?: SupervisorDegradedFallbackContext,
  metadata?: T
): T & {
  fallback?: boolean;
  degradedFromMode?: 'multi';
  degradedReason?: SupervisorDegradedFallbackContext['degradedReason'];
  fallbackReason?: string;
} {
  const safeMetadata = (metadata ?? {}) as T;
  const existingFallbackReason =
    typeof safeMetadata.fallbackReason === 'string'
      ? safeMetadata.fallbackReason
      : undefined;
  if (!context) {
    return safeMetadata;
  }

  return {
    fallback: true,
    degradedFromMode: context.degradedFromMode,
    degradedReason: context.degradedReason,
    fallbackReason: existingFallbackReason ?? context.degradedReason,
    ...safeMetadata,
  };
}

export function applyDegradedMetadata(
  response: SupervisorResponse,
  context?: SupervisorDegradedFallbackContext
): SupervisorResponse {
  if (!context) {
    return response;
  }

  return {
    ...response,
    metadata: buildDegradedMetadata(context, response.metadata),
  };
}
