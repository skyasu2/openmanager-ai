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
import { buildKnowledgeBaseGroundedAnswer } from './supervisor-stream-citations';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import type { StreamEvent, SupervisorRequest } from './supervisor-types';
import type { CollectedToolResult } from './supervisor-stream-helpers';

type KnowledgeTool = {
  execute?: (input: Record<string, unknown>) => Promise<unknown>;
};

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
    const collectedToolResults: CollectedToolResult[] = [
      { toolName: 'searchKnowledgeBase', result: knowledgeResult },
    ];
    const answer =
      buildKnowledgeBaseGroundedAnswer(queryText, collectedToolResults, {
        internalDisclosureMode: request.internalDisclosureMode,
      }) ??
      [
        '내부 근거를 찾지 못했습니다.',
        `- 질의: ${queryText}`,
        '- 정확한 repo 경로, 문서명, 운영 파일 위치는 추정하지 않습니다.',
      ].join('\n');
    const ragSources = extractRagSources('searchKnowledgeBase', knowledgeResult);
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

  return true;
}
