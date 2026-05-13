import { evaluateAgentResponseQuality } from './agents/response-quality';
import type { ProviderName } from './model-provider';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import {
  buildDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import {
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import type { SupervisorResponse } from './supervisor-types';

const NO_PROVIDER_RESPONSE =
  '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.';

export function buildNoProviderFallbackResponse({
  durationMs,
  modeDecision,
  runtimeMetadata,
  degradedFallbackContext,
}: {
  durationMs: number;
  modeDecision?: ResolvedSupervisorModeDecision;
  runtimeMetadata?: AssistantRuntimeMetadata;
  degradedFallbackContext?: SupervisorDegradedFallbackContext;
}): SupervisorResponse {
  const quality = evaluateAgentResponseQuality('Supervisor', NO_PROVIDER_RESPONSE, {
    durationMs,
    fallbackReason: 'NO_PROVIDER',
  });

  return {
    success: true,
    response: NO_PROVIDER_RESPONSE,
    toolsCalled: [],
    toolResults: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metadata: {
      provider: 'none' as ProviderName,
      modelId: 'none',
      stepsExecuted: 0,
      durationMs,
      responseChars: quality.responseChars,
      formatCompliance: quality.formatCompliance,
      qualityFlags: quality.qualityFlags,
      latencyTier: quality.latencyTier,
      ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
      ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
      ...buildDegradedMetadata(degradedFallbackContext, {
        fallback: true,
        fallbackReason: 'no_provider',
      }),
    },
  };
}
