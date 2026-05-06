import {
  hasToolCall,
  stepCountIs,
  type ToolSet,
} from 'ai';
import { TIMEOUT_CONFIG } from '../../config/timeout-config';
import { extractRagSources, extractToolResultOutput, type RagSource } from '../../lib/ai-sdk-utils';
import { getPublicErrorMessage, getPublicErrorResponse } from '../../lib/error-handler';
import { isTavilyAvailable } from '../../lib/tavily-hybrid-rag';
import { logger } from '../../lib/logger';
import { isSingleModeAllowed } from '../../lib/config-parser';
import { createSupervisorTrace, finalizeTrace, logGeneration, logToolCall } from '../observability/langfuse';
import { CircuitOpenError, getCircuitBreaker } from '../resilience/circuit-breaker';
import {
  markProviderQuotaCooldown,
  reconcileProviderQuotaReservation,
  reserveProviderQuota,
  type LLMProviderName as QuotaProviderName,
  type ProviderQuotaReservation,
} from '../resilience/quota-tracker';
import { executeMultiAgentStream } from './agents';
import {
  resolveMonitoringSupervisorRuntimeContext,
  type AssistantRuntimeMetadata,
} from './monitoring-runtime-host';
import {
  filterToolsByRAG,
  filterToolsByWebSearch,
  resolveRAGSetting,
  resolveWebSearchSetting,
} from './agents/orchestrator-web-search';
import {
  getSupervisorModel,
  getVisionAgentModel,
  logProviderStatus,
  recordModelUsage,
  type ProviderName,
} from './model-provider';
import {
  buildDegradedMetadata,
  hasMeaningfulMultiAgentOutput,
  shouldFallbackFromMultiAgentError,
  type SupervisorDegradedFallbackContext,
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
  buildSupervisorStreamMessages,
  getLastUserQueryText,
} from './supervisor-stream-messages';
import {
  buildWebCitationAppendix,
  buildKnowledgeBaseGroundedAnswer,
  buildWebSearchFallbackAnswer,
  hasWebSearchFallbackAnswer,
} from './supervisor-stream-citations';
import { createStructuredTextDeltaGuard } from './supervisor-stream-text-guard';
import { buildDeterministicSummaryFallback } from './agents/orchestrator-summary-fallback';
import { FORCE_KB_QUERY_PATTERN } from './query-routing-signals';
import type {
  AgentStepStatus,
  StreamEvent,
  SupervisorRequest,
} from './supervisor-types';

const PROVIDER_FALLBACK_BASE_DELAY_MS = 150;
const PROVIDER_FALLBACK_JITTER_MS = 250;
const APPROX_CHARS_PER_TOKEN = 4;
const SUPERVISOR_STREAM_MAX_OUTPUT_TOKENS = 2048;

function isQuotaTrackedProvider(provider: ProviderName): provider is QuotaProviderName {
  return (
    provider === 'cerebras' ||
    provider === 'groq' ||
    provider === 'mistral' ||
    provider === 'gemini'
  );
}

function isProviderRateLimitErrorMessage(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('too many requests') ||
    normalized.includes('too_many_requests') ||
    normalized.includes('queue_exceeded') ||
    normalized.includes('high traffic')
  );
}

function estimateSupervisorStreamQuotaTokens(
  messages: unknown[],
  maxOutputTokens = SUPERVISOR_STREAM_MAX_OUTPUT_TOKENS
): number {
  const inputChars = messages.reduce<number>(
    (total, message) => total + JSON.stringify(message).length,
    0
  );
  return Math.ceil(inputChars / APPROX_CHARS_PER_TOKEN) + maxOutputTokens;
}

type TextDeltaStreamPart = {
  type: 'text-delta';
  text: string;
};

type SupervisorFullStreamPart = {
  type: string;
  text?: unknown;
  toolName?: unknown;
  toolCallId?: unknown;
  error?: unknown;
};

type CollectedToolResult = {
  toolName: string;
  result: unknown;
};

type SearchWebFallbackInput = {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
};

type ToolCallLike = {
  toolName?: unknown;
  input?: unknown;
  args?: unknown;
};

type StepLike = {
  toolCalls?: ToolCallLike[];
};

async function* textStreamAsFullStream(
  textStream: AsyncIterable<string>
): AsyncGenerator<TextDeltaStreamPart> {
  for await (const text of textStream) {
    yield { type: 'text-delta', text };
  }
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .map((item) => readNonEmptyString(item))
    .filter((item): item is string => item !== null);
  return values.length > 0 ? values : undefined;
}

function readSearchDepth(value: unknown): 'basic' | 'advanced' | undefined {
  return value === 'basic' || value === 'advanced' ? value : undefined;
}

function readSearchWebInput(value: unknown): SearchWebFallbackInput | null {
  const input = readRecord(value);
  if (!input) return null;

  const query = readNonEmptyString(input.query);
  if (!query) return null;

  return {
    query,
    maxResults: readNumber(input.maxResults),
    searchDepth: readSearchDepth(input.searchDepth),
    includeDomains: readStringArray(input.includeDomains),
    excludeDomains: readStringArray(input.excludeDomains),
  };
}

function findSearchWebInputFromSteps(
  steps: StepLike[]
): SearchWebFallbackInput | null {
  for (const step of steps) {
    for (const toolCall of step.toolCalls ?? []) {
      if (toolCall.toolName !== 'searchWeb') continue;
      const input =
        readSearchWebInput(toolCall.input) ?? readSearchWebInput(toolCall.args);
      if (input) return input;
    }
  }

  return null;
}

function hasSearchWebCall(steps: StepLike[]): boolean {
  return steps.some((step) =>
    (step.toolCalls ?? []).some((toolCall) => toolCall.toolName === 'searchWeb')
  );
}

async function executeSearchWebFallbackFromSteps(
  steps: StepLike[],
  userQuery: string,
  tools: ToolSet
): Promise<CollectedToolResult | null> {
  if (!hasSearchWebCall(steps)) return null;

  const input = findSearchWebInputFromSteps(steps) ?? {
    query: userQuery,
  };
  const query = readNonEmptyString(userQuery) ?? input.query;
  if (!query) return null;

  const fallbackInput: SearchWebFallbackInput = {
    ...input,
    query,
    maxResults: Math.max(input.maxResults ?? 0, 5),
  };

  const searchWebTool = readRecord(tools)?.searchWeb;
  const execute = readRecord(searchWebTool)?.execute;
  if (typeof execute !== 'function') return null;

  try {
    const result = await execute(fallbackInput);
    return { toolName: 'searchWeb', result };
  } catch (error) {
    logger.warn(
      '[SupervisorStream] searchWeb fallback execution failed:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

function readToolStep(
  streamPart: SupervisorFullStreamPart
): { key: string; tool: string } | null {
  const tool = readNonEmptyString(streamPart.toolName);
  if (!tool) return null;

  const toolCallId = readNonEmptyString(streamPart.toolCallId);
  return {
    key: toolCallId ? `${toolCallId}:${tool}` : tool,
    tool,
  };
}

function buildAgentStepEvent(
  tool: string,
  status: AgentStepStatus
): StreamEvent {
  return {
    type: 'agent_step',
    data: { tool, status },
  };
}

async function waitBeforeProviderFallback(
  provider: ProviderName,
  reason: string
): Promise<void> {
  const jitter = Math.floor(Math.random() * (PROVIDER_FALLBACK_JITTER_MS + 1));
  const delay = PROVIDER_FALLBACK_BASE_DELAY_MS + jitter;
  logger.debug(
    `[SupervisorStream] Provider fallback delay ${delay}ms (${provider}, reason=${reason})`
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function reserveSupervisorStreamQuota(
  provider: ProviderName,
  modelId: string,
  estimatedTokens: number
): Promise<ProviderQuotaReservation | null> {
  if (!isQuotaTrackedProvider(provider)) return null;
  return reserveProviderQuota(provider, estimatedTokens, modelId);
}

async function reconcileSupervisorStreamQuota(
  reservation: ProviderQuotaReservation | null,
  actualTokensUsed: number
): Promise<void> {
  await reconcileProviderQuotaReservation(reservation, actualTokensUsed);
}

async function markSupervisorStreamCooldown(
  provider: ProviderName,
  modelId: string,
  errorMessage: string
): Promise<void> {
  if (!isQuotaTrackedProvider(provider)) return;
  if (!isProviderRateLimitErrorMessage(errorMessage)) return;
  await markProviderQuotaCooldown(provider, modelId, errorMessage);
}

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

  logger.info({
    sessionId: request.sessionId,
    requestedMode: modeDecision.requestedMode,
    resolvedMode: modeDecision.resolvedMode,
    modeSelectionSource: modeDecision.modeSelectionSource,
    autoSelectedByComplexity: modeDecision.autoSelectedByComplexity,
  }, '[SupervisorStream] Mode resolved');

  if (mode === 'multi') {
    try {
      let emittedMeaningfulOutput = false;
      for await (const event of executeMultiAgentStream({
        messages: request.messages,
        sessionId: request.sessionId,
        ...buildSupervisorModeMetadata(modeDecision),
        traceId: request.traceId,
        enableTracing: request.enableTracing,
        enableWebSearch: request.enableWebSearch,
        enableRAG: request.enableRAG,
        images: request.images,
        files: request.files,
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
              runtimeMetadata
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
          runtimeMetadata
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
    runtimeMetadata
  );
}

async function* streamSingleAgent(
  request: SupervisorRequest,
  startTime: number,
  runtimeTools: ToolSet,
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
  runtimeMetadata?: AssistantRuntimeMetadata,
): AsyncGenerator<StreamEvent> {
  const hasImages = request.images && request.images.length > 0;
  const routeDecision = modeDecision
    ? buildSupervisorRouteDecision(modeDecision, {
        traceId: request.traceId,
        queryAsOf: request.queryAsOf,
      })
    : undefined;
  const assistantPlan = routeDecision
    ? buildSupervisorAssistantPlanForRequest(request, routeDecision)
    : undefined;
  const excludedProviders: ProviderName[] = [];
  const MAX_PROVIDER_ATTEMPTS = 3;

  // Provider-independent setup (hoisted outside retry loop)
  const queryText = getLastUserQueryText(request.messages);
  const runtimeHost = request.runtimeHost;
  if (!runtimeHost) {
    throw new Error('Supervisor runtime host is required for stream execution');
  }
  const modelMessages = buildSupervisorStreamMessages(
    request,
    runtimeHost.createSystemPrompt({ deviceType: request.deviceType })
  );

  let webSearchEnabled = resolveWebSearchSetting(request.enableWebSearch, queryText);
  if (webSearchEnabled && !isTavilyAvailable()) {
    logger.warn('[Stream Single] Web search requested but Tavily unavailable');
    webSearchEnabled = false;
    yield { type: 'warning', data: { code: 'WEB_SEARCH_UNAVAILABLE', message: '웹 검색을 사용할 수 없습니다. 내부 데이터로 응답합니다.' } };
  }
  logger.debug(`[Stream Single WebSearch] Setting resolved: ${webSearchEnabled} (request: ${request.enableWebSearch})`);
  const ragEnabled = resolveRAGSetting(request.enableRAG, queryText);
  logger.debug(`[Stream Single RAG] Setting: ${ragEnabled} (request: ${request.enableRAG})`);
  let filteredTools = filterToolsByWebSearch(runtimeTools, webSearchEnabled);
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);

  if (ragEnabled && FORCE_KB_QUERY_PATTERN.test(queryText)) {
    const knowledgeTool = (filteredTools as Record<string, unknown>)
      .searchKnowledgeBase as
      | { execute?: (input: Record<string, unknown>) => Promise<unknown> }
      | undefined;

    if (typeof knowledgeTool?.execute === 'function') {
      const directStartTime = Date.now();
      const toolsCalled = ['searchKnowledgeBase'];

      yield {
        type: 'agent_status',
        data: {
          agent: 'Supervisor',
          status: 'processing',
          message: '내부 지식 문서를 검색 중...',
        },
      };
      yield { type: 'tool_call', data: { name: 'searchKnowledgeBase' } };

      try {
        const knowledgeResult = await knowledgeTool.execute({
          query: queryText,
          fastMode: true,
          includeWebSearch: false,
        });
        const collectedToolResults: CollectedToolResult[] = [
          { toolName: 'searchKnowledgeBase', result: knowledgeResult },
        ];
        const answer =
          buildKnowledgeBaseGroundedAnswer(queryText, collectedToolResults) ??
          [
            '내부 근거를 찾지 못했습니다.',
            `- 질의: ${queryText}`,
            '- 정확한 repo 경로, 문서명, 운영 파일 위치는 추정하지 않습니다.',
          ].join('\n');
        const ragSources = extractRagSources(
          'searchKnowledgeBase',
          knowledgeResult
        );
        const durationMs = Date.now() - directStartTime;

        yield {
          type: 'tool_result',
          data: { toolName: 'searchKnowledgeBase', result: knowledgeResult },
        };
        yield { type: 'text_delta', data: answer };
        yield {
          type: 'done',
          data: {
            success: true,
            toolsCalled,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            metadata: {
              provider: 'deterministic',
              modelId: 'knowledge-search-direct',
              stepsExecuted: 1,
              durationMs,
              mode: 'single',
              ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
              ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
              ...(routeDecision && { routeDecision }),
              ...(assistantPlan && { assistantPlan }),
              ...(routeDecision && {
                assistantResult: buildSupervisorAssistantResult(routeDecision),
              }),
              ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
              ...buildDegradedMetadata(degradedFallbackContext, {}),
            },
            ...(ragSources.length > 0 && { ragSources }),
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const durationMs = Date.now() - directStartTime;
        const answer = [
          '내부 지식 검색을 실행하지 못했습니다.',
          `- 질의: ${queryText}`,
          `- 오류: ${errorMessage}`,
          '- 검색 근거 없이 repo 경로, 문서명, 운영 파일 위치를 추정하지 않습니다.',
        ].join('\n');

        logger.warn(
          '[SupervisorStream] Direct knowledge lookup failed:',
          errorMessage
        );
        yield {
          type: 'warning',
          data: {
            code: 'RAG_SEARCH_FAILED',
            message:
              '내부 지식 검색을 실행하지 못해 근거 없는 경로 추정을 차단했습니다.',
          },
        };
        yield { type: 'text_delta', data: answer };
        yield {
          type: 'done',
          data: {
            success: true,
            toolsCalled,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            metadata: {
              provider: 'deterministic',
              modelId: 'knowledge-search-direct',
              stepsExecuted: 1,
              durationMs,
              mode: 'single',
              ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
              ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
              ...(routeDecision && { routeDecision }),
              ...(assistantPlan && { assistantPlan }),
              ...(routeDecision && {
                assistantResult: buildSupervisorAssistantResult(routeDecision),
              }),
              ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
              ...buildDegradedMetadata(degradedFallbackContext, {}),
            },
            warning: {
              code: 'RAG_SEARCH_FAILED',
              message:
                '내부 지식 검색을 실행하지 못해 근거 없는 경로 추정을 차단했습니다.',
            },
          },
        };
      }
      return;
    }
  }

  // Provider retry loop: automatically falls back to next provider on failure
  providerLoop:
  for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt++) {
    let provider: ProviderName;
    let modelId: string;
    let model;

    // --- 1. Model Selection ---
    try {
      if (attempt === 0) logProviderStatus();

      if (hasImages) {
        const visionModel = getVisionAgentModel();
        if (!visionModel) {
          yield {
            type: 'error',
            data: { code: 'NO_VISION_PROVIDER', message: getPublicErrorMessage('NO_VISION_PROVIDER') },
          };
          return;
        }
        model = visionModel.model;
        provider = visionModel.provider;
        modelId = visionModel.modelId;
        logger.info(`[SingleAgent] Using Vision Agent (Gemini) for ${request.images!.length} image(s)`);
      } else {
        const modelResult = getSupervisorModel(excludedProviders);
        model = modelResult.model;
        provider = modelResult.provider;
        modelId = modelResult.modelId;
      }
    } catch {
      // No more providers available
      const fallbackMessage = '현재 AI 엔진 모델이 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.';
      yield { type: 'text_delta', data: fallbackMessage };
      yield {
        type: 'done',
        data: {
          success: true,
          toolsCalled: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: {
            provider: 'none',
            modelId: 'none',
            stepsExecuted: 0,
            durationMs: Date.now() - startTime,
            mode: 'single',
            ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
            ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
            ...(routeDecision && { routeDecision }),
            ...(assistantPlan && { assistantPlan }),
            ...(routeDecision && {
              assistantResult: buildSupervisorAssistantResult(routeDecision),
            }),
            ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
            ...buildDegradedMetadata(degradedFallbackContext, {
              fallback: true,
              fallbackReason: 'no_provider',
            }),
          },
        },
      };
      return;
    }

    // --- 2. Circuit Breaker Check ---
    const circuitBreaker = getCircuitBreaker(`stream-${provider}`);

    if (!circuitBreaker.isAllowed()) {
      const cbStats = circuitBreaker.getStats();
      logger.warn(`[SupervisorStream] Circuit OPEN for ${provider}`, {
        failures: cbStats.failures,
        totalFailures: cbStats.totalFailures,
        lastFailure: cbStats.lastFailure?.toISOString(),
      });
      excludedProviders.push(provider);
      if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
        yield {
          type: 'agent_status',
          data: {
            agent: 'Supervisor',
            status: 'processing',
            message: `${provider} 일시 차단됨, 대안 모델로 전환 중...`,
          },
        };
        await waitBeforeProviderFallback(provider, 'circuit_open');
        continue providerLoop;
      }
      yield {
        type: 'error',
        data: {
          code: 'CIRCUIT_OPEN',
          message: getPublicErrorMessage('CIRCUIT_OPEN'),
          metadata: {
            provider,
            failures: cbStats.totalFailures,
            lastFailure: cbStats.lastFailure?.toISOString(),
          },
        },
      };
      return;
    }

    // --- 3. Stream Execution ---
    let quotaReservation: ProviderQuotaReservation | null = null;
    let quotaReservationReconciled = false;
    const reconcileQuotaOnce = async (actualTokensUsed: number) => {
      if (quotaReservationReconciled) return;
      await reconcileSupervisorStreamQuota(quotaReservation, actualTokensUsed);
      quotaReservationReconciled = true;
    };

    try {
      logger.info(`[SupervisorStream] Using ${provider}/${modelId}${attempt > 0 ? ` (retry #${attempt})` : ''}`);
      const providerStartTime = Date.now();
      const estimatedTokens = estimateSupervisorStreamQuotaTokens(modelMessages);
      quotaReservation = await reserveSupervisorStreamQuota(
        provider,
        modelId,
        estimatedTokens
      );

      if (quotaReservation && !quotaReservation.reserved) {
        const quotaError = `QUOTA_ADMISSION:${quotaReservation.reason ?? 'unknown'}`;
        excludedProviders.push(provider);
        logger.info(
          `[SupervisorStream] Skipping ${provider}/${modelId}: quota admission ${quotaReservation.reason ?? 'blocked'}`
        );
        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          yield {
            type: 'agent_status',
            data: {
              agent: 'Supervisor',
              status: 'processing',
              message: `${provider} 쿼터 보호로 대안 모델로 전환 중...`,
            },
          };
          await waitBeforeProviderFallback(provider, 'quota_admission');
          continue providerLoop;
        }
        yield {
          type: 'error',
          data: {
            code: 'RATE_LIMITED',
            message: getPublicErrorMessage('RATE_LIMIT'),
            metadata: {
              provider,
              modelId,
              reason: quotaReservation.reason,
              recommendedWaitMs: quotaReservation.recommendedWaitMs,
            },
          },
        };
        logger.warn(`[SupervisorStream] ${quotaError}`);
        return;
      }

      const trace = createSupervisorTrace({
        sessionId: request.sessionId,
        mode: 'single',
        query: queryText,
        upstreamTraceId: request.traceId,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
      });

      const toolsCalled: string[] = [];
      const recordedToolsCalled = new Set<string>();
      const recordToolCalled = (toolName: string) => {
        if (recordedToolsCalled.has(toolName)) return;
        recordedToolsCalled.add(toolName);
        toolsCalled.push(toolName);
      };
      let fullText = '';
      let streamError: Error | null = null;
      const abortController = new AbortController();
      const textDeltaGuard = createStructuredTextDeltaGuard();

      const prepareStep = runtimeHost.createPrepareStep(queryText, {
        enableWebSearch: webSearchEnabled,
        enableRAG: ragEnabled,
      });

      if (!runtimeHost.executeLLMStream) {
        throw new Error('Supervisor runtime host stream execution adapter is required');
      }

      const result = runtimeHost.executeLLMStream({
        model,
        messages: modelMessages,
        tools: filteredTools,
        ...(prepareStep && { prepareStep }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(4)],
        temperature: 0.3,
        maxOutputTokens: 2048,
        timeout: {
          totalMs:
            TIMEOUT_CONFIG.supervisor.hardStreaming ??
            TIMEOUT_CONFIG.supervisor.hard,
          stepMs: TIMEOUT_CONFIG.agent.hard,
          chunkMs: 30_000,
        },
        abortSignal: abortController.signal,
        onError: ({ error }) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          logger.error('❌ [SingleAgent] streamText error:', {
            error: error instanceof Error ? error.message : String(error),
            model: modelId,
            provider,
            query: queryText.substring(0, 100),
          });
          streamError = error instanceof Error ? error : new Error(String(error));
        },
        onStepFinish: ({ finishReason, toolCalls, toolResults: stepToolResults }) => {
          const toolNames = toolCalls?.map((tc) => tc.toolName) || [];
          logger.debug(`[Stream Step] reason=${finishReason}, tools=[${toolNames.join(',')}]`);

          if (trace && toolCalls?.length) {
            for (const tc of toolCalls) {
              const tr = stepToolResults?.find((r) => r.toolCallId === tc.toolCallId);
              logToolCall(trace, tc.toolName, tc.input, tr?.output, 0);
            }
          }
        },
        onFinish: ({ text, finishReason, steps: finishSteps }) => {
          const durationMs = Date.now() - startTime;
          const allToolsCalled = finishSteps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || []);
          logger.info(
            `[Stream Finish] reason=${finishReason}, steps=${finishSteps.length}, tools=[${allToolsCalled.join(',')}], duration=${durationMs}ms`
          );

          if (trace && finishReason !== 'error') {
            finalizeTrace(trace, text, true, {
              toolsCalled: allToolsCalled,
              stepsExecuted: finishSteps.length,
              durationMs,
              finishReason,
              ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
              ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
              ...buildDegradedMetadata(degradedFallbackContext, {}),
            });
          }
        },
      });

      const SINGLE_AGENT_HARD_TIMEOUT = TIMEOUT_CONFIG.supervisor.hardStreaming ?? TIMEOUT_CONFIG.supervisor.hard;
      const TIMEOUT_WARNING_THRESHOLD =
        TIMEOUT_CONFIG.supervisor.warningStreaming ??
        Math.max(
          TIMEOUT_CONFIG.supervisor.warning,
          Math.round(SINGLE_AGENT_HARD_TIMEOUT * 0.8)
        );
      let warningEmitted = false;
      let firstChunkMs: number | null = null;

      const emitDisplayText = function* (text: string): Generator<StreamEvent> {
        if (text.length === 0) return;
        fullText += text;
        yield { type: 'text_delta', data: text };
      };
      const markFirstStreamOutput = () => {
        if (firstChunkMs !== null) return;
        firstChunkMs = Date.now() - providerStartTime;
        logger.info(
          `[SupervisorStream] TTFB: ${firstChunkMs}ms (${provider}/${modelId})`
        );
      };

      const startedAgentSteps = new Set<string>();
      const completedAgentSteps = new Set<string>();
      const collectedToolResults: CollectedToolResult[] = [];
      const streamParts =
        result.fullStream ?? textStreamAsFullStream(result.textStream);

      for await (const streamPart of streamParts) {
        const elapsed = Date.now() - startTime;

        if (!warningEmitted && elapsed >= TIMEOUT_WARNING_THRESHOLD) {
          warningEmitted = true;
          logger.warn(`⚠️ [SingleAgent] Approaching timeout at ${elapsed}ms`);
          yield {
            type: 'warning',
            data: {
              code: 'SLOW_PROCESSING',
              message: '응답 생성이 지연되고 있습니다. 곧 완료됩니다.',
              elapsed,
              threshold: TIMEOUT_WARNING_THRESHOLD,
            },
          };
        }

        if (elapsed >= SINGLE_AGENT_HARD_TIMEOUT) {
          logger.error(
            `🛑 [SingleAgent] Hard timeout reached at ${elapsed}ms (limit: ${SINGLE_AGENT_HARD_TIMEOUT}ms)`
          );

          if (fullText.length > 0) {
            yield {
              type: 'text_delta',
              data: '\n\n---\n⏱️ *응답 시간 초과로 여기까지만 전달됩니다.*',
            };
          }

          yield {
            type: 'error',
            data: {
              code: 'HARD_TIMEOUT',
              error: getPublicErrorMessage('HARD_TIMEOUT'),
              elapsed,
              partialResponseLength: fullText.length,
              suggestion: fullText.length > 0
                ? '부분 응답이 제공되었습니다. 추가 정보가 필요하면 질문을 더 구체적으로 해주세요.'
                : '쿼리를 간단하게 나눠서 다시 시도해주세요.',
            },
          };

          abortController.abort();

          return;
        }

        if (streamPart.type === 'text-delta') {
          const text = typeof streamPart.text === 'string' ? streamPart.text : '';
          for (const displayText of textDeltaGuard.push(text)) {
            markFirstStreamOutput();
            yield* emitDisplayText(displayText);
          }
        } else if (streamPart.type === 'tool-call') {
          const toolStep = readToolStep(streamPart);
          if (toolStep && !startedAgentSteps.has(toolStep.key)) {
            recordToolCalled(toolStep.tool);
            startedAgentSteps.add(toolStep.key);
            markFirstStreamOutput();
            yield buildAgentStepEvent(toolStep.tool, 'start');
          }
        } else if (
          streamPart.type === 'tool-result' ||
          streamPart.type === 'tool-error' ||
          streamPart.type === 'tool-output-denied'
        ) {
          const toolStep = readToolStep(streamPart);
          if (streamPart.type === 'tool-result' && toolStep) {
            const streamToolResult = extractToolResultOutput(streamPart);
            if (streamToolResult !== undefined) {
              collectedToolResults.push({
                toolName: toolStep.tool,
                result: streamToolResult,
              });
            }
          }
          if (toolStep && !completedAgentSteps.has(toolStep.key)) {
            completedAgentSteps.add(toolStep.key);
            markFirstStreamOutput();
            yield buildAgentStepEvent(toolStep.tool, 'done');
          }
        } else if (streamPart.type === 'error') {
          streamError =
            streamPart.error instanceof Error
              ? streamPart.error
              : new Error(String(streamPart.error ?? 'stream error'));
        }
      }

      for (const displayText of textDeltaGuard.flush()) {
        markFirstStreamOutput();
        yield* emitDisplayText(displayText);
      }

      // Resolve steps/usage early — needed to extract finalAnswer before empty-text check
      const stepsAndUsage = await Promise.all([result.steps, result.usage]).catch((stepsError) => {
        logger.warn('[SupervisorStream] Steps/usage unavailable:', stepsError instanceof Error ? stepsError.message : String(stepsError));
        return undefined;
      });
      const steps = stepsAndUsage?.[0] ?? [];
      const usage = stepsAndUsage?.[1];
      await reconcileQuotaOnce(
        usage?.totalTokens ?? quotaReservation?.estimatedTokens ?? 0
      );
      for (const step of steps) {
        if (!step.toolResults) continue;
        for (const tr of step.toolResults) {
          collectedToolResults.push({
            toolName: tr.toolName,
            result: extractToolResultOutput(tr),
          });
        }
      }

      if (textDeltaGuard.hasRawToolCall() && fullText.trim().length === 0) {
        const toolName = textDeltaGuard.getRawToolCallName();
        const formatError = `MODEL_EMITTED_RAW_TOOL_CALL_JSON${toolName ? `:${toolName}` : ''}`;
        excludedProviders.push(provider);

        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          finalizeTrace(trace, '', false, {
            toolsCalled: toolName ? [toolName] : [],
            stepsExecuted: steps.length,
            durationMs: Date.now() - startTime,
            error: formatError,
            ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
            ...buildDegradedMetadata(degradedFallbackContext, {}),
          });
          logger.warn(
            `[SupervisorStream] ${provider}/${modelId} emitted raw tool-call JSON${toolName ? ` (${toolName})` : ''}; retrying with next provider`
          );
          yield {
            type: 'agent_status',
            data: {
              agent: 'Supervisor',
              status: 'processing',
              message: `${provider} 응답 형식 오류로 대안 모델로 전환 중...`,
            },
          };
          await waitBeforeProviderFallback(provider, 'raw_tool_call_json');
          continue providerLoop;
        }

        const fallbackText =
          'AI 엔진이 도구 호출 정보를 응답 본문으로 반환해 표시를 차단했습니다. 같은 질문을 다시 시도해 주세요.';
        yield {
          type: 'warning',
          data: {
            code: 'RAW_TOOL_CALL_JSON_SUPPRESSED',
            message:
              '도구 호출 JSON이 응답 본문으로 반환되어 표시를 차단했습니다.',
          },
        };
        yield* emitDisplayText(fallbackText);
      }

      const deterministicSummary = buildDeterministicSummaryFallback(
        queryText,
        'Supervisor',
        collectedToolResults
      );
      if (fullText.trim().length === 0 && deterministicSummary) {
        fullText = deterministicSummary;
        if (firstChunkMs === null) {
          firstChunkMs = Date.now() - providerStartTime;
          logger.info(
            `[SupervisorStream] TTFB recovered via deterministic summary: ${firstChunkMs}ms (${provider}/${modelId})`
          );
        }
        yield { type: 'text_delta', data: fullText };
        logger.info('[SupervisorStream] Recovered response from deterministic tool summary');
        if (streamError !== null) {
          logger.warn(
            '[SupervisorStream] Suppressed stream error after deterministic tool summary recovery:',
            streamError.message
          );
          streamError = null;
        }
      }

      // Recover response from finalAnswer tool result when textStream was empty
      // (LLM may produce no text when it only calls tools and terminates via finalAnswer)
      if (fullText.trim().length === 0) {
        for (const step of steps) {
          if (fullText.trim().length > 0) break;
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              if (tr.toolName === 'finalAnswer') {
                const trOutput = extractToolResultOutput(tr);
                if (trOutput && typeof trOutput === 'object') {
                  const finalResult = trOutput as Record<string, unknown>;
                  if ('answer' in finalResult && typeof finalResult.answer === 'string' && finalResult.answer.trim().length > 0) {
                    fullText = finalResult.answer;
                    if (firstChunkMs === null) {
                      firstChunkMs = Date.now() - providerStartTime;
                      logger.info(
                        `[SupervisorStream] TTFB recovered via finalAnswer: ${firstChunkMs}ms (${provider}/${modelId})`
                      );
                    }
                    yield { type: 'text_delta', data: fullText };
                    logger.info('[SupervisorStream] Recovered response from finalAnswer tool result');
                  }
                }
              }
            }
          }
        }
      }

      if (fullText.trim().length === 0) {
        if (!hasWebSearchFallbackAnswer(collectedToolResults)) {
          const recoveredSearchWebResult =
            await executeSearchWebFallbackFromSteps(
              steps,
              queryText,
              filteredTools
            );
          if (recoveredSearchWebResult) {
            collectedToolResults.push(recoveredSearchWebResult);
          }
        }
        const webSearchFallback =
          buildWebSearchFallbackAnswer(collectedToolResults);
        if (webSearchFallback) {
          fullText = webSearchFallback;
          if (firstChunkMs === null) {
            firstChunkMs = Date.now() - providerStartTime;
            logger.info(
              `[SupervisorStream] TTFB recovered via web search fallback: ${firstChunkMs}ms (${provider}/${modelId})`
            );
          }
          yield { type: 'text_delta', data: fullText };
          logger.info(
            '[SupervisorStream] Recovered empty response from searchWeb tool result'
          );
        }
      }

      // ★ Provider retry: if no text produced + stream error, try next provider
      if (fullText.trim().length === 0 && streamError !== null) {
        const failedError = streamError as Error;
        excludedProviders.push(provider);
      finalizeTrace(trace, '', false, {
        toolsCalled,
        stepsExecuted: steps.length,
        durationMs: Date.now() - startTime,
        error: failedError.message,
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
      });

        if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
          logger.warn(
            `⚠️ [SingleAgent] ${provider}/${modelId} failed without output (${failedError.message}), retrying with next provider...`
          );
          await reconcileQuotaOnce(0);
          await markSupervisorStreamCooldown(provider, modelId, failedError.message);
          yield {
            type: 'agent_status',
            data: {
              agent: 'Supervisor',
              status: 'processing',
              message: `${provider} 응답 없음, 대안 모델로 전환 중...`,
            },
          };
          await waitBeforeProviderFallback(provider, 'empty_output_with_error');
          continue providerLoop;
        }
      }

      if (fullText.trim().length === 0) {
        const fallbackText =
          '응답 본문이 비어 있어 요약 결과를 생성하지 못했습니다. 질문을 조금 더 구체적으로 다시 시도해 주세요.';
        const durationAtEmpty = Date.now() - startTime;
        logger.warn({
          event: 'empty_stream_output',
          provider,
          modelId,
          query: queryText.substring(0, 100),
          stepsCount: steps.length,
          toolsCalled: steps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || []),
          durationMs: durationAtEmpty,
          hasStreamError: streamError !== null,
          streamErrorMessage: streamError !== null ? (streamError as Error).message : null,
        }, '[SupervisorStream] Empty stream output — diagnosing root cause');
        yield {
          type: 'warning',
          data: {
            code: 'EMPTY_RESPONSE',
            message:
              '모델이 빈 응답을 반환했습니다. 기본 안내 문구로 대체합니다.',
          },
        };
        yield { type: 'text_delta', data: fallbackText };
        fullText = fallbackText;
      }

      if (streamError !== null) {
        yield {
          type: 'warning',
          data: {
            code: 'STREAM_ERROR_OCCURRED',
            message: (streamError as Error).message,
          },
        };
      }

      const ragSources: RagSource[] = [];

      for (const step of steps) {
        for (const toolCall of step.toolCalls) {
          const toolName = toolCall.toolName;
          recordToolCalled(toolName);
          yield { type: 'tool_call', data: { name: toolName } };
        }
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            const trOutput = extractToolResultOutput(tr);
            if (trOutput !== undefined) {
              yield { type: 'tool_result', data: { toolName: tr.toolName, result: trOutput } };
              logToolCall(trace, tr.toolName, {}, trOutput, 0);
            }

            ragSources.push(...extractRagSources(tr.toolName, trOutput));
          }
        }
      }
      for (const tr of collectedToolResults) {
        ragSources.push(...extractRagSources(tr.toolName, tr.result));
      }

      const webCitationAppendix = buildWebCitationAppendix(
        fullText,
        ragSources
      );
      if (webCitationAppendix.length > 0) {
        fullText += webCitationAppendix;
        yield { type: 'text_delta', data: webCitationAppendix };
      }

      const durationMs = Date.now() - startTime;

      logGeneration(trace, {
        model: modelId,
        provider,
        input: queryText,
        output: fullText,
        usage: {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        },
        duration: durationMs,
      });

      const capturedError = streamError as Error | null;
      const streamSucceeded = capturedError === null;
      finalizeTrace(trace, fullText, streamSucceeded, {
        toolsCalled,
        stepsExecuted: steps.length,
        durationMs,
        ...(firstChunkMs !== null && { ttfbMs: firstChunkMs }),
        ...(capturedError && { error: capturedError.message }),
        ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
        ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
        ...buildDegradedMetadata(degradedFallbackContext, {}),
      });

      logger.info(
        `[SupervisorStream] Completed in ${durationMs}ms, tools: [${toolsCalled.join(', ')}]`
      );

      const totalTokensUsed = usage?.totalTokens ?? 0;
      if (!quotaReservation?.reserved && totalTokensUsed > 0) {
        await recordModelUsage(provider, totalTokensUsed, 'supervisor-stream', modelId);
      }

      yield {
        type: 'done',
        data: {
          success: capturedError === null,
          toolsCalled,
          usage: {
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
            totalTokens: totalTokensUsed,
          },
          metadata: {
            provider,
            modelId,
            stepsExecuted: steps.length,
            durationMs,
            mode: 'single',
            traceId: trace.id,
            ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
            ...(modeDecision ? buildSupervisorModeMetadata(modeDecision) : {}),
            ...(routeDecision && { routeDecision }),
            ...(assistantPlan && { assistantPlan }),
            ...(routeDecision && {
              assistantResult: buildSupervisorAssistantResult(routeDecision, {
                status: capturedError === null ? 'completed' : 'failed',
                ...(capturedError && {
                  errorCode: 'SUPERVISOR_STREAM_ERROR',
                }),
              }),
            }),
            ...(runtimeMetadata && { assistantRuntime: runtimeMetadata }),
            ...buildDegradedMetadata(degradedFallbackContext, {}),
            ...(attempt > 0 && { providerRetries: attempt }),
          },
          ...(ragSources.length > 0 && { ragSources }),
          ...(capturedError && {
            warning: {
              code: 'STREAM_ERROR_OCCURRED',
              message: getPublicErrorMessage('STREAM_ERROR_OCCURRED'),
            },
          }),
        },
      };
      return;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await reconcileQuotaOnce(0);
      await markSupervisorStreamCooldown(provider, modelId, errorMessage);
      const publicError = error instanceof CircuitOpenError
        ? { code: 'CIRCUIT_OPEN', message: getPublicErrorMessage('CIRCUIT_OPEN') }
        : getPublicErrorResponse(error);

      logger.error(`❌ [SupervisorStream] ${provider}/${modelId} error after ${durationMs}ms:`, errorMessage);

      // Try next provider if available
      excludedProviders.push(provider);
      if (!hasImages && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
        logger.warn(`⚠️ [SingleAgent] ${provider}/${modelId} threw error, trying next provider...`);
        yield {
          type: 'agent_status',
          data: {
            agent: 'Supervisor',
            status: 'processing',
            message: `${provider} 오류 발생, 대안 모델로 전환 중...`,
          },
        };
        await waitBeforeProviderFallback(provider, 'provider_error');
        continue providerLoop;
      }

      yield {
        type: 'error',
        data: {
          code: publicError.code,
          message: publicError.message,
        },
      };
      return;
    }
  }
}
