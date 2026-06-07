import type { ToolSet } from 'ai';
import { isSingleModeAllowed } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import { executeMultiAgent, type MultiAgentRequest, type MultiAgentResponse } from './agents';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import { type ProviderName, recordModelUsage } from './model-provider';
import {
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import {
  shouldFallbackFromMultiAgentError,
} from './supervisor-multi-fallback';
import type { SupervisorRequest, SupervisorResponse, SupervisorError } from './supervisor-types';
import { buildSupervisorLogContextPrompt } from './supervisor-log-context';
import { executeSingleAgentMode } from './supervisor-single-agent-mode';

export async function executeMultiAgentMode(
  request: SupervisorRequest,
  startTime: number,
  modeDecision: ResolvedSupervisorModeDecision,
  runtimeMetadata: AssistantRuntimeMetadata,
  runtimeTools: ToolSet
): Promise<SupervisorResponse | SupervisorError> {
  try {
    const multiAgentRequest: MultiAgentRequest = {
      messages: request.messages,
      sessionId: request.sessionId,
      domainId: request.runtimeHost?.domain.id,
      ...buildSupervisorModeMetadata(modeDecision),
      traceId: request.traceId,
      enableTracing: request.enableTracing,
      enableWebSearch: request.enableWebSearch,
      enableRAG: request.enableRAG,
      ...(request.internalDisclosureMode && {
        internalDisclosureMode: request.internalDisclosureMode,
      }),
      images: request.images,
      files: request.files,
      domain: request.runtimeHost?.domain,
      dataSource: request.runtimeHost?.domain.dataSource,
      metadata: request.metadata,
      domainEvidencePrompt: buildSupervisorLogContextPrompt(request.metadata),
    };

    const result = await executeMultiAgent(multiAgentRequest);

    if (!result.success) {
      const multiAgentError = result as SupervisorError;
      if (
        isSingleModeAllowed() &&
        shouldFallbackFromMultiAgentError(multiAgentError.code)
      ) {
        const degradedReason =
          multiAgentError.code === 'MODEL_UNAVAILABLE'
            ? 'multi_agent_model_unavailable'
            : 'multi_agent_runtime_error';
        logger.info(
          `[Supervisor] Falling back to single-agent mode (degraded) after multi-agent error: ${multiAgentError.code}`
        );
        return executeSingleAgentMode(
          request,
          startTime,
          {
            degradedFromMode: 'multi',
            degradedReason,
          },
          modeDecision,
          runtimeMetadata,
          runtimeTools
        );
      }
      return multiAgentError;
    }

    const multiResult = result as MultiAgentResponse;

    if (multiResult.usage.totalTokens > 0) {
      await recordModelUsage(
        multiResult.metadata.provider as ProviderName,
        multiResult.usage.totalTokens,
        'multi-agent',
        multiResult.metadata.modelId
      );
    }

    const sanitizedResponse = {
      success: true,
      response: multiResult.response,
      toolsCalled: multiResult.toolsCalled,
      toolResults: [],
      ragSources: multiResult.ragSources,
      evidenceCards: multiResult.evidenceCards,
      usage: multiResult.usage,
      metadata: {
        provider: multiResult.metadata.provider,
        modelId: multiResult.metadata.modelId,
        stepsExecuted: multiResult.metadata.totalRounds,
        durationMs: multiResult.metadata.durationMs,
        traceId: multiResult.metadata.traceId,
        responseChars: multiResult.metadata.responseChars,
        formatCompliance: multiResult.metadata.formatCompliance,
        qualityFlags: multiResult.metadata.qualityFlags,
        latencyTier: multiResult.metadata.latencyTier,
        mode: 'multi',
        ...buildSupervisorModeMetadata(modeDecision),
        handoffs: multiResult.handoffs,
        finalAgent: multiResult.finalAgent,
        retrieval: multiResult.metadata.retrieval,
        assistantRuntime: runtimeMetadata,
      },
    };

    return sanitizedResponse as SupervisorResponse;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      `❌ [Supervisor] Multi-agent error after ${durationMs}ms:`,
      errorMessage
    );

    if (isSingleModeAllowed()) {
      logger.info('[Supervisor] Falling back to single-agent mode (degraded)');
      return executeSingleAgentMode(
        request,
        startTime,
        {
          degradedFromMode: 'multi',
          degradedReason: 'multi_agent_runtime_error',
        },
        modeDecision,
        runtimeMetadata,
        runtimeTools
      );
    }

    logger.error('[Supervisor] Single-agent fallback NOT allowed. Failing fast.');
    return {
      success: false,
      error: errorMessage,
      code: 'MULTI_AGENT_FAILED',
    };
  }
}
