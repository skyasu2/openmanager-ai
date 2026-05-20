import { generateText } from 'ai';
import type { ToolSet } from 'ai';
import { extractRagSources } from '../../lib/ai-sdk-utils';
import { logger } from '../../lib/logger';
import { FORCE_KB_QUERY_PATTERN } from './routing/query-routing-signals';
import {
  buildDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import {
  buildSupervisorAssistantResult,
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
  type SupervisorAssistantPlan,
  type SupervisorRouteDecision,
} from './supervisor-mode';
import {
  buildGroundedKRLSystemPrompt,
  buildKnowledgeBaseGroundedAnswer,
} from './supervisor-stream-citations';
import { getAdvisorModel } from './agents/config/agent-model-selectors';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import type { StreamEvent, SupervisorRequest } from './supervisor-types';
import type { CollectedToolResult } from './supervisor-stream-helpers';

type KnowledgeTool = {
  execute?: (input: Record<string, unknown>) => Promise<unknown>;
};

type GroundedLLMResult =
  | { ok: true; text: string; provider: string; modelId: string; tokens: number }
  | { ok: false; reason: string };

const GROUNDED_LLM_TIMEOUT_MS = 10_000;

async function tryGroundedLLMSynthesis(
  systemPrompt: string,
  query: string
): Promise<GroundedLLMResult> {
  const modelResult = getAdvisorModel();
  if (!modelResult) {
    return { ok: false, reason: 'no_advisor_model_available' };
  }

  const { model, provider, modelId } = modelResult;

  const timeoutPromise = new Promise<GroundedLLMResult>((resolve) =>
    setTimeout(
      () => resolve({ ok: false, reason: 'timeout' }),
      GROUNDED_LLM_TIMEOUT_MS
    )
  );

  const generatePromise = generateText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
    temperature: 0.1,
    maxOutputTokens: 800,
  }).then(
    (result): GroundedLLMResult => ({
      ok: true,
      text: result.text,
      provider: String(provider),
      modelId,
      tokens: result.usage?.totalTokens ?? 0,
    }),
    (error): GroundedLLMResult => ({
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    })
  );

  return Promise.race([generatePromise, timeoutPromise]);
}

function readKnowledgeResultsFromRaw(
  raw: unknown
): Array<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const results = Array.isArray(obj.results) ? obj.results : [];
  const similar = Array.isArray(obj.similarCases) ? obj.similarCases : [];
  return [...results, ...similar].filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object'
  );
}

function buildDoneMetadata(
  opts: {
    provider: string;
    modelId: string;
    durationMs: number;
    groundingMode: 'llm-synthesized' | 'template-fallback';
    kbSourceCount: number;
    tokens?: number;
    request: SupervisorRequest;
    modeDecision?: ResolvedSupervisorModeDecision;
    routeDecision?: SupervisorRouteDecision;
    assistantPlan?: SupervisorAssistantPlan;
    runtimeMetadata?: AssistantRuntimeMetadata;
    degradedFallbackContext?: SupervisorDegradedFallbackContext;
  }
) {
  return {
    provider: opts.provider,
    modelId: opts.modelId,
    stepsExecuted: 1,
    durationMs: opts.durationMs,
    mode: 'single' as const,
    groundingMode: opts.groundingMode,
    kbSourceCount: opts.kbSourceCount,
    ...(opts.request.queryAsOf && { queryAsOf: opts.request.queryAsOf }),
    ...(opts.modeDecision ? buildSupervisorModeMetadata(opts.modeDecision) : {}),
    ...(opts.routeDecision && { routeDecision: opts.routeDecision }),
    ...(opts.assistantPlan && { assistantPlan: opts.assistantPlan }),
    ...(opts.routeDecision && {
      assistantResult: buildSupervisorAssistantResult(opts.routeDecision),
    }),
    ...(opts.runtimeMetadata && { assistantRuntime: opts.runtimeMetadata }),
    ...buildDegradedMetadata(opts.degradedFallbackContext, {}),
  };
}

export async function* streamDirectKnowledgeSearchIfMatched({
  request,
  queryText,
  filteredTools,
  degradedFallbackContext,
  modeDecision,
  routeDecision,
  assistantPlan,
  runtimeMetadata,
}: {
  request: SupervisorRequest;
  queryText: string;
  filteredTools: ToolSet;
  degradedFallbackContext?: SupervisorDegradedFallbackContext;
  modeDecision?: ResolvedSupervisorModeDecision;
  routeDecision?: SupervisorRouteDecision;
  assistantPlan?: SupervisorAssistantPlan;
  runtimeMetadata?: AssistantRuntimeMetadata;
}): AsyncGenerator<StreamEvent, boolean> {
  if (!FORCE_KB_QUERY_PATTERN.test(queryText)) return false;

  const knowledgeTool = (filteredTools as Record<string, unknown>)
    .searchKnowledgeBase as KnowledgeTool | undefined;
  if (typeof knowledgeTool?.execute !== 'function') return false;

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

    const ragSources = extractRagSources('searchKnowledgeBase', knowledgeResult);
    const kbResults = readKnowledgeResultsFromRaw(knowledgeResult);

    yield {
      type: 'tool_result',
      data: { toolName: 'searchKnowledgeBase', result: knowledgeResult },
    };

    // — Grounded LLM 합성 시도 —
    let answer: string;
    let groundingMode: 'llm-synthesized' | 'template-fallback';
    let resolvedProvider: string;
    let resolvedModelId: string;
    let resolvedTokens = 0;

    if (kbResults.length > 0) {
      yield {
        type: 'agent_status',
        data: {
          agent: 'Supervisor',
          status: 'processing',
          message: '검색 결과를 바탕으로 답변을 구성 중...',
        },
      };

      const systemPrompt = buildGroundedKRLSystemPrompt(kbResults, queryText);
      const llmResult = await tryGroundedLLMSynthesis(systemPrompt, queryText);

      if (llmResult.ok) {
        answer = llmResult.text;
        groundingMode = 'llm-synthesized';
        resolvedProvider = llmResult.provider;
        resolvedModelId = llmResult.modelId;
        resolvedTokens = llmResult.tokens;
        logger.info(
          `[DirectKB] Grounded LLM synthesis ok (${llmResult.provider}/${llmResult.modelId}, ${llmResult.tokens} tokens)`
        );
      } else {
        logger.warn(
          `[DirectKB] Grounded LLM synthesis failed (${llmResult.reason}), falling back to template`
        );
        yield {
          type: 'warning',
          data: {
            code: 'GROUNDED_LLM_FAILED',
            message: `LLM 합성에 실패해 템플릿 응답으로 전환했습니다. (${llmResult.reason})`,
          },
        };
        const collectedToolResults: CollectedToolResult[] = [
          { toolName: 'searchKnowledgeBase', result: knowledgeResult },
        ];
        answer =
          buildKnowledgeBaseGroundedAnswer(queryText, collectedToolResults, {
            internalDisclosureMode: request.internalDisclosureMode,
          }) ??
          ['내부 근거를 찾지 못했습니다.', `- 질의: ${queryText}`].join('\n');
        groundingMode = 'template-fallback';
        resolvedProvider = 'deterministic';
        resolvedModelId = 'knowledge-search-direct';
      }
    } else {
      // KB 결과 없음 — 템플릿 응답
      const collectedToolResults: CollectedToolResult[] = [
        { toolName: 'searchKnowledgeBase', result: knowledgeResult },
      ];
      answer =
        buildKnowledgeBaseGroundedAnswer(queryText, collectedToolResults, {
          internalDisclosureMode: request.internalDisclosureMode,
        }) ??
        ['내부 근거를 찾지 못했습니다.', `- 질의: ${queryText}`].join('\n');
      groundingMode = 'template-fallback';
      resolvedProvider = 'deterministic';
      resolvedModelId = 'knowledge-search-direct';
    }

    const durationMs = Date.now() - directStartTime;

    yield { type: 'text_delta', data: answer };
    yield {
      type: 'done',
      data: {
        success: true,
        toolsCalled,
        usage: {
          promptTokens: 0,
          completionTokens: resolvedTokens,
          totalTokens: resolvedTokens,
        },
        metadata: buildDoneMetadata({
          provider: resolvedProvider,
          modelId: resolvedModelId,
          durationMs,
          groundingMode,
          kbSourceCount: kbResults.length,
          tokens: resolvedTokens,
          request,
          modeDecision,
          routeDecision,
          assistantPlan,
          runtimeMetadata,
          degradedFallbackContext,
        }),
        ...(ragSources.length > 0 && { ragSources }),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - directStartTime;
    const answer = [
      '내부 지식 검색을 실행하지 못했습니다.',
      `- 질의: ${queryText}`,
      `- 오류: ${errorMessage}`,
      '- 검색 근거 없이 repo 경로, 문서명, 운영 파일 위치를 추정하지 않습니다.',
    ].join('\n');

    logger.warn('[SupervisorStream] Direct knowledge lookup failed:', errorMessage);
    yield {
      type: 'warning',
      data: {
        code: 'RAG_SEARCH_FAILED',
        message: '내부 지식 검색을 실행하지 못해 근거 없는 경로 추정을 차단했습니다.',
      },
    };
    yield { type: 'text_delta', data: answer };
    yield {
      type: 'done',
      data: {
        success: true,
        toolsCalled,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: buildDoneMetadata({
          provider: 'deterministic',
          modelId: 'knowledge-search-direct',
          durationMs,
          groundingMode: 'template-fallback',
          kbSourceCount: 0,
          request,
          modeDecision,
          routeDecision,
          assistantPlan,
          runtimeMetadata,
          degradedFallbackContext,
        }),
        warning: {
          code: 'RAG_SEARCH_FAILED',
          message: '내부 지식 검색을 실행하지 못해 근거 없는 경로 추정을 차단했습니다.',
        },
      },
    };
  }

  return true;
}
