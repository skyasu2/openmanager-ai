import { logger } from '../../lib/logger';
import { isSingleModeAllowed } from '../../lib/config-parser';
import { executeMultiAgentStream } from './agents';
import { resolveMonitoringSupervisorRuntimeContext } from './monitoring-runtime-host';
import {
  hasMeaningfulMultiAgentOutput,
  shouldFallbackFromMultiAgentError,
} from './supervisor-multi-fallback';
import {
  buildSupervisorAssistantPlanForRequest,
  buildSupervisorAssistantResult,
  buildSupervisorModeMetadata,
  buildSupervisorRouteDecision,
  resolveSupervisorModeDecision,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import {
  getLastUserQueryText,
} from './supervisor-stream-messages';
import { resolveDomainEvidenceForStream } from './supervisor-domain-evidence';
import {
  buildInternalImplementationPathPolicyMetadata,
  buildInternalImplementationPathRefusal,
  shouldRefuseInternalImplementationPathRequest,
} from './internal-disclosure-policy';
import { buildServiceCommandGuidanceAnswer } from '../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import { streamSingleAgent } from './supervisor-single-agent-stream';
import type { StreamEvent, SupervisorRequest } from './supervisor-types';

export async function* executeSupervisorStream(
  request: SupervisorRequest
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();
  const runtimeContext = await resolveMonitoringSupervisorRuntimeContext(request);
  const runtimeMetadata = runtimeContext.metadata;
  const runtimeTools = runtimeContext.host.createToolSet(
    runtimeContext.result.context
  );
  const runtimeRequest: SupervisorRequest =
    request.runtimeHost === runtimeContext.host
      ? request
      : { ...request, runtimeHost: runtimeContext.host };
  const modeDecision = resolveSupervisorModeDecision(runtimeRequest);
  const routeDecision = buildSupervisorRouteDecision(modeDecision, {
    traceId: request.traceId,
    queryAsOf: request.queryAsOf,
  });
  const assistantPlan = buildSupervisorAssistantPlanForRequest(
    runtimeRequest,
    routeDecision
  );
  const mode = modeDecision.resolvedMode;
  const queryText = getLastUserQueryText(runtimeRequest.messages);
  const domainEvidence = await resolveDomainEvidenceForStream({
    request: runtimeRequest,
    query: queryText,
    domain: runtimeContext.host.domain,
  }) ?? undefined;
  const semanticQueryTrace = domainEvidence?.metadata?.semanticQueryTrace;

  logger.info({
    sessionId: request.sessionId,
    requestedMode: modeDecision.requestedMode,
    resolvedMode: modeDecision.resolvedMode,
    modeSelectionSource: modeDecision.modeSelectionSource,
    autoSelectedByComplexity: modeDecision.autoSelectedByComplexity,
  }, '[SupervisorStream] Mode resolved');

  if (
    shouldRefuseInternalImplementationPathRequest(
      queryText,
      runtimeRequest.internalDisclosureMode
    )
  ) {
    const durationMs = Date.now() - startTime;
    const answer = buildInternalImplementationPathRefusal();
    yield { type: 'text_delta', data: answer };
    yield {
      type: 'done',
      data: {
        success: true,
        toolsCalled: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          ...buildInternalImplementationPathPolicyMetadata(durationMs),
          mode,
          ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
          ...buildSupervisorModeMetadata(modeDecision),
          routeDecision,
          assistantPlan,
          assistantRuntime: runtimeMetadata,
          assistantResult: buildSupervisorAssistantResult(routeDecision),
          ...(semanticQueryTrace !== undefined && semanticQueryTrace !== null
            ? { semanticQueryTrace }
            : {}),
        },
      },
    };
    return;
  }

  const serviceCommandAnswer = buildServiceCommandGuidanceAnswer(queryText);
  if (serviceCommandAnswer) {
    const durationMs = Date.now() - startTime;
    yield { type: 'text_delta', data: serviceCommandAnswer };
    yield {
      type: 'done',
      data: {
        success: true,
        toolsCalled: ['recommendCommands'],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          provider: 'deterministic',
          modelId: 'service-command-catalog',
          stepsExecuted: 0,
          durationMs,
          mode,
          ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
          ...buildSupervisorModeMetadata(modeDecision),
          routeDecision,
          assistantPlan,
          assistantRuntime: runtimeMetadata,
          assistantResult: buildSupervisorAssistantResult(routeDecision),
          ...(semanticQueryTrace !== undefined && semanticQueryTrace !== null
            ? { semanticQueryTrace }
            : {}),
        },
      },
    };
    return;
  }

  if (mode === 'multi') {
    try {
      let emittedMeaningfulOutput = false;
      for await (const event of executeMultiAgentStream({
        messages: request.messages,
        sessionId: request.sessionId,
        domainId: runtimeContext.host.domain.id,
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
        dataSource: runtimeContext.host.domain.dataSource,
        domainEvidencePrompt: domainEvidence?.prompt,
      })) {
        if (event.type === 'error') {
          const errorData = event.data as { code?: string };
          if (
            !emittedMeaningfulOutput &&
            isSingleModeAllowed() &&
            shouldFallbackFromMultiAgentError(errorData.code)
          ) {
            const degradedReason =
              errorData.code === 'MODEL_UNAVAILABLE'
                ? 'multi_agent_model_unavailable'
                : 'multi_agent_runtime_error';
            logger.info(
              `[SupervisorStream] Falling back to single-agent mode (degraded) after multi-agent error: ${errorData.code}`
            );
            yield {
              type: 'agent_status',
              data: {
                agent: 'Orchestrator',
                status: 'processing',
                message: '오케스트레이터 오류로 단일 분석 모드로 전환합니다.',
              },
            };
            yield* streamSingleAgent(
              runtimeRequest,
              startTime,
              runtimeTools,
              {
                degradedFromMode: 'multi',
                degradedReason,
              },
              modeDecision,
              runtimeMetadata,
              domainEvidence
            );
            return;
          }
        }

        if (hasMeaningfulMultiAgentOutput(event.type)) {
          emittedMeaningfulOutput = true;
        }

        if (event.type === 'done') {
          const doneData = event.data as Record<string, unknown>;
          const existingMetadata =
            typeof doneData.metadata === 'object' && doneData.metadata !== null
              ? (doneData.metadata as Record<string, unknown>)
              : {};
          yield {
            ...event,
            data: {
              ...doneData,
              metadata: {
                ...existingMetadata,
                ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
                ...buildSupervisorModeMetadata(modeDecision),
                routeDecision,
                assistantPlan,
                assistantRuntime: runtimeMetadata,
                assistantResult: buildSupervisorAssistantResult(routeDecision, {
                  status: doneData.success === false ? 'failed' : 'completed',
                  ...(doneData.success === false && {
                    errorCode: 'SUPERVISOR_STREAM_FAILED',
                  }),
                }),
                ...(semanticQueryTrace !== undefined && semanticQueryTrace !== null
                  ? { semanticQueryTrace }
                  : {}),
              },
            },
          };
          continue;
        }

        yield event;
      }
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ [SupervisorStream] Multi-agent error: ${errorMessage}`);

      if (isSingleModeAllowed()) {
        logger.info('[SupervisorStream] Falling back to single-agent mode (degraded)');
        yield { 
          type: 'agent_status', 
          data: { 
            agent: 'Orchestrator',
            status: 'processing', 
            message: '오케스트레이터 오류로 단일 분석 모드로 전환합니다.' 
          } 
        };
        yield* streamSingleAgent(
          runtimeRequest,
          startTime,
          runtimeTools,
          {
            degradedFromMode: 'multi',
            degradedReason: 'multi_agent_runtime_error',
          },
          modeDecision,
          runtimeMetadata,
          domainEvidence
        );
        return;
      }

      logger.error('[SupervisorStream] Single-agent fallback NOT allowed. Failing fast.');
      yield { 
        type: 'error', 
        data: { 
          code: 'MULTI_AGENT_FAILED', 
          error: errorMessage 
        } 
      };
      return;
    }
  }

  yield* streamSingleAgent(
    runtimeRequest,
    startTime,
    runtimeTools,
    undefined,
    modeDecision,
    runtimeMetadata,
    domainEvidence
  );
}
