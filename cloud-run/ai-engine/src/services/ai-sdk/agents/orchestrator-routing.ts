/**
 * Orchestrator Routing Logic
 *
 * Model selection, Reporter Pipeline, Agent config/forced routing,
 * and AgentFactory-based execution.
 *
 * @version 4.0.0
 */

import { generateText, hasToolCall, stepCountIs } from 'ai';
import type { ProviderName } from '../model-provider';
import {
  generateTextWithRetry,
  type ProviderAttempt,
} from '../../resilience/retry-with-fallback';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import {
  AGENT_NAMES,
  getAgentConfig as getNamedAgentConfig,
  type AgentConfig,
} from './config';
import {
  selectTextModel,
  type TextProvider,
  type ModelResult,
} from './config/agent-model-selectors';
import { AgentFactory, type AgentType } from './agent-factory';
import type { ImageAttachment, FileAttachment } from './base-agent';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';

import type {
  MultiAgentResponse,
  ProviderAttemptTelemetry,
} from './orchestrator-types';
import { filterToolsByWebSearch, filterToolsByRAG } from './orchestrator-web-search';
import { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
import { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';
import { evaluateAgentResponseQuality } from './response-quality';
import { FORCE_KB_QUERY_PATTERN } from '../query-routing-signals';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
} from './orchestrator-summary-fallback';
import { logger } from '../../../lib/logger';
export { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
export { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';

// ============================================================================
// Orchestrator Model (3-way fallback)
// ============================================================================

export const ORCHESTRATOR_PROVIDER_ORDER: TextProvider[] = [
  'cerebras',
  'groq',
  'mistral',
];

function buildContextAwarePrompt(query: string, contextSummary?: string | null): string {
  if (!contextSummary) {
    return query;
  }

  return `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}`;
}

export function getOrchestratorModel(): ModelResult | null {
  // Orchestrator uses generateObject (requires json_schema support).
  // Keep Cerebras first for routing-only structured output; Groq is the
  // validated fallback, and Mistral stays last because its free RPM is tight.
  return selectTextModel('Orchestrator', ORCHESTRATOR_PROVIDER_ORDER, {
    cbPrefix: 'orchestrator',
    requiredCapabilities: { requireStructuredOutput: true },
  });
}

// Log available agents from AGENT_CONFIGS
const availableAgentNames = AGENT_NAMES.filter(name => {
  const config = getNamedAgentConfig(name);
  return config && config.getModel() !== null;
});

if (availableAgentNames.length === 0) {
  logger.error('❌ [CRITICAL] No agents available! Check API keys: CEREBRAS_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY');
} else {
  logger.info(`[Orchestrator] Available agents: ${availableAgentNames.length} - [${availableAgentNames.join(', ')}]`);
}

// ============================================================================
// Agent Execution (AI SDK v6 Native)
// ============================================================================

export function getAgentConfig(name: string): AgentConfig | null {
  return getNamedAgentConfig(name) ?? null;
}

export function getAgentProviderOrder(agentName: string): ProviderName[] {
  switch (agentName) {
    case 'NLQ Agent':
      return ['groq', 'cerebras', 'mistral'];
    case 'Advisor Agent':
      return ['groq', 'cerebras', 'mistral'];
    case 'Analyst Agent':
      return ['groq', 'cerebras', 'mistral'];
    case 'Reporter Agent':
      return ['groq', 'cerebras', 'mistral'];
    default:
      return ['groq', 'cerebras', 'mistral'];
  }
}

/**
 * Per-agent maxSteps configuration
 *
 * Analyst/Reporter need more steps for multi-tool workflows:
 * - Analyst: detectAnomaliesAllServers + searchKnowledgeBase + findRootCause + finalAnswer
 * - Reporter: buildIncidentTimeline + findRootCause + correlateMetrics + finalAnswer
 */
export function getAgentMaxSteps(agentName: string): number {
  switch (agentName) {
    case 'Analyst Agent':
    case 'Reporter Agent':
      return 10;
    default:
      return 7;
  }
}

interface DirectKnowledgeResultItem {
  title: string;
  content: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
}

interface DirectKnowledgeSearchResult {
  success: boolean;
  results: DirectKnowledgeResultItem[];
  totalFound: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDirectKnowledgeResultItem(value: unknown): DirectKnowledgeResultItem | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title : '';
  const content = typeof value.content === 'string' ? value.content : '';
  const similarity = toNumber(value.similarity) ?? 0;
  const sourceType = typeof value.sourceType === 'string' ? value.sourceType : 'vector';

  if (!title || !content) {
    return null;
  }

  return {
    title,
    content,
    similarity,
    sourceType,
    category: typeof value.category === 'string' ? value.category : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
  };
}

function toProviderAttemptTelemetry(
  attempts: ProviderAttempt[]
): ProviderAttemptTelemetry[] {
  return attempts.map((attempt) => ({
    provider: attempt.provider,
    modelId: attempt.modelId,
    attempt: attempt.attempt,
    durationMs: attempt.durationMs,
    ...(attempt.error ? { error: attempt.error } : {}),
  }));
}

function resolveFallbackReason(
  attempts: ProviderAttempt[],
  usedFallback: boolean
): string | undefined {
  if (!usedFallback) {
    return undefined;
  }

  const failedAttempt = attempts.find((attempt) => attempt.error);
  if (!failedAttempt) {
    return 'provider_fallback';
  }

  const normalizedError = failedAttempt.error?.toLowerCase() ?? '';
  if (normalizedError.includes('rate limit') || normalizedError.includes('429')) {
    return 'rate_limit';
  }
  if (normalizedError.includes('timeout')) {
    return 'timeout';
  }
  if (
    normalizedError.includes('missing required capabilities') ||
    normalizedError.includes('tool-calling') ||
    normalizedError.includes('structured-output')
  ) {
    return 'capability_mismatch';
  }
  if (
    normalizedError.includes('does not exist') ||
    normalizedError.includes('no access') ||
    normalizedError.includes('model not found') ||
    normalizedError.includes('404')
  ) {
    return 'model_unavailable';
  }
  if (
    normalizedError.includes('unavailable') ||
    normalizedError.includes('503') ||
    normalizedError.includes('502') ||
    normalizedError.includes('504')
  ) {
    return 'provider_unavailable';
  }

  return 'provider_error';
}

function asDirectKnowledgeSearchResult(value: unknown): DirectKnowledgeSearchResult | null {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.results)) {
    return null;
  }

  const results = value.results
    .map(asDirectKnowledgeResultItem)
    .filter((item): item is DirectKnowledgeResultItem => item !== null);

  return {
    success: true,
    results,
    totalFound: toNumber(value.totalFound) ?? results.length,
  };
}

function extractServerCountHint(results: DirectKnowledgeResultItem[]): number | null {
  for (const result of results) {
    const match = result.content.match(/총\s*(\d+)\s*대/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function buildTopologyDirectKnowledgeResponse(
  query: string,
  results: DirectKnowledgeResultItem[],
): string {
  const topResults = results.slice(0, 3);
  const sourceSummary = {
    vector: results.filter((item) => item.sourceType === 'vector').length,
    graph: results.filter((item) => item.sourceType === 'graph').length,
    web: results.filter((item) => item.sourceType === 'web').length,
  };
  const serverCountHint = extractServerCountHint(results);
  const titleBullets = topResults
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join('\n');

  return [
    '### 인프라 토폴로지 요약',
    `- 질의: ${query}`,
    `- 근거 문서: ${results.length}건 (vector ${sourceSummary.vector}, graph ${sourceSummary.graph}, web ${sourceSummary.web})`,
    serverCountHint !== null
      ? `- 확인된 서버 규모 힌트: 총 ${serverCountHint}대`
      : '- 서버 규모는 KB 문서 기준으로 파악되며, 실시간 수치는 별도 조회가 필요합니다.',
    '',
    '#### 문제/원인 관점',
    '- 이번 요청은 장애 원인 진단보다 현재 구성/트래픽 경로 확인 목적입니다.',
    '- 원인 분석이 필요하면 `findRootCause`/`correlateMetrics` 기반 추가 점검이 필요합니다.',
    '',
    '#### 핵심 근거 문서',
    titleBullets,
    '',
    '#### 해결/권장 조치',
    '1. `getServerMetrics`로 LB→WEB→APP→DB 구간의 현재 부하(CPU/메모리)를 즉시 확인하세요.',
    '2. `getServerLogs`로 WEB/APP 계층 에러 로그를 교차 점검해 병목 지점을 좁히세요.',
    '3. 토폴로지 변경 전에는 관련 runbook과 최근 incident 유사 사례를 함께 검토하세요.',
  ].join('\n');
}

export async function executeForcedRouting(
  query: string,
  suggestedAgentName: string,
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[],
  contextSummary?: string | null,
): Promise<MultiAgentResponse | null> {
  logger.info(`[Forced Routing] Looking up agent config: "${suggestedAgentName}"`);

  if (suggestedAgentName === 'Reporter Agent') {
    logger.info(`[Forced Routing] Routing to Reporter Pipeline`);
    const pipelineResult = await executeReporterWithPipeline(query, startTime);
    if (pipelineResult) {
      return pipelineResult;
    }
    logger.info(`[Forced Routing] Pipeline failed, falling back to direct Reporter Agent`);
  }

  const agentConfig = getNamedAgentConfig(suggestedAgentName);

  if (!agentConfig) {
    logger.warn(`⚠️ [Forced Routing] No config for "${suggestedAgentName}"`);
    return null;
  }

  const providerOrder = getAgentProviderOrder(suggestedAgentName);
  logger.info(`[Forced Routing] Using retry with fallback: [${providerOrder.join(' → ')}]`);

  let filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);
  const isForceKnowledgeBaseQuery = FORCE_KB_QUERY_PATTERN.test(query);
  const forceKnowledgeBaseTool =
    ragEnabled &&
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    'searchKnowledgeBase' in filteredTools;

  // Topology/architecture queries can bypass LLM generation by using
  // direct KB retrieval + deterministic synthesis.
  if (forceKnowledgeBaseTool) {
    const directSearchTool = (filteredTools as Record<string, unknown>)
      .searchKnowledgeBase as { execute?: (input: Record<string, unknown>) => Promise<unknown> };

    if (typeof directSearchTool?.execute === 'function') {
      try {
        const directSearchResult = await directSearchTool.execute({
          query,
          category: 'architecture',
          fastMode: true,
          includeWebSearch: false,
        });
        const parsedDirectResult = asDirectKnowledgeSearchResult(directSearchResult);

        if (parsedDirectResult && parsedDirectResult.results.length > 0) {
          const durationMs = Date.now() - startTime;
          const response = sanitizeChineseCharacters(
            buildTopologyDirectKnowledgeResponse(query, parsedDirectResult.results)
          );
          const quality = evaluateAgentResponseQuality('Advisor Agent', response, { durationMs });

          logger.info(
            `[Forced Routing] Topology direct KB path succeeded in ${durationMs}ms (${parsedDirectResult.results.length} docs)`
          );

          return {
            success: true,
            response,
            ragSources: parsedDirectResult.results.map((item) => ({
              title: item.title,
              similarity: item.similarity,
              sourceType: item.sourceType,
              category: item.category,
              url: item.url,
            })),
            handoffs: [{
              from: 'Orchestrator',
              to: suggestedAgentName,
              reason: 'Forced routing (topology direct KB path)',
            }],
            finalAgent: suggestedAgentName,
            toolsCalled: ['searchKnowledgeBase', 'finalAnswer'],
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            metadata: {
              provider: 'deterministic',
              modelId: 'knowledge-search-direct',
              totalRounds: 1,
              handoffCount: 1,
              durationMs,
              responseChars: quality.responseChars,
              formatCompliance: quality.formatCompliance,
              qualityFlags: quality.qualityFlags,
              latencyTier: quality.latencyTier,
            },
          };
        }
      } catch (error) {
        logger.warn(
          '[Forced Routing] Topology direct KB path failed, falling back to LLM routing:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
  const attachmentHint =
    images?.length || files?.length
      ? `\n\n[첨부 컨텍스트]\n- images: ${images?.length ?? 0}\n- files: ${files?.length ?? 0}`
      : '';
  const executionPrompt = buildContextAwarePrompt(`${query}${attachmentHint}`, contextSummary);

  // Per-agent maxSteps: Analyst/Reporter need more steps for multi-tool workflows
  const agentMaxSteps = getAgentMaxSteps(suggestedAgentName);

  try {
    const retryResult = await generateTextWithRetry(
      {
        messages: [
          { role: 'system', content: agentConfig.instructions },
          { role: 'user', content: executionPrompt },
        ],
        tools: filteredTools as Parameters<typeof generateText>[0]['tools'],
        ...(forceKnowledgeBaseTool && {
          toolChoice: { type: 'tool' as const, toolName: 'searchKnowledgeBase' as const },
        }),
        stopWhen: [hasToolCall('finalAnswer'), stepCountIs(agentMaxSteps)],
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      providerOrder,
      { timeoutMs: 60000 }
    );

    if (!retryResult.success || !retryResult.result) {
      logger.warn(`⚠️ [Forced Routing] All providers failed for ${suggestedAgentName}`);
      for (const attempt of retryResult.attempts) {
        logger.warn(`  - ${attempt.provider}: ${attempt.error || 'unknown error'}`);
      }
      return null;
    }

    const { result, provider, modelId, usedFallback, attempts } = retryResult;
    const durationMs = Date.now() - startTime;
    const providerAttempts = toProviderAttemptTelemetry(attempts);
    const fallbackReason = resolveFallbackReason(attempts, usedFallback);

    const toolsCalled: string[] = [];
    const collectedToolResults: Array<{ toolName: string; result: unknown }> = [];
    let finalAnswerResult: { answer: string } | null = null;
    const ragSources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }> = [];

    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        toolsCalled.push(toolCall.toolName);
      }
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const trOutput = extractToolResultOutput(tr);
          collectedToolResults.push({
            toolName: tr.toolName,
            result: trOutput,
          });

          if (tr.toolName === 'finalAnswer' && trOutput && typeof trOutput === 'object') {
            finalAnswerResult = trOutput as { answer: string };
          }

          if (tr.toolName === 'searchKnowledgeBase' && trOutput && typeof trOutput === 'object') {
            const kbResult = trOutput as Record<string, unknown>;
            const similarCases = (kbResult.similarCases ?? kbResult.results) as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(similarCases)) {
              for (const doc of similarCases) {
                ragSources.push({
                  title: String(doc.title ?? doc.name ?? 'Unknown'),
                  similarity: Number(doc.similarity ?? doc.score ?? 0),
                  sourceType: String(doc.sourceType ?? doc.type ?? 'vector'),
                  category: doc.category ? String(doc.category) : undefined,
                });
              }
            }
          }

          if (tr.toolName === 'searchWeb' && trOutput && typeof trOutput === 'object') {
            const webResult = trOutput as Record<string, unknown>;
            const webResults = webResult.results as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(webResults)) {
              for (const doc of webResults) {
                ragSources.push({
                  title: String(doc.title ?? 'Web Result'),
                  similarity: Number(doc.score ?? 0),
                  sourceType: 'web',
                  category: 'web-search',
                  url: doc.url ? String(doc.url) : undefined,
                });
              }
            }
          }
        }
      }
    }

    let response = finalAnswerResult?.answer ?? result.text;
    const deterministicSummary = buildDeterministicSummaryFallback(
      query,
      suggestedAgentName,
      collectedToolResults
    );

    if (deterministicSummary) {
      const overridingGeneratedText =
        typeof response === 'string' && response.trim().length > 0;
      response = deterministicSummary;
      logger.info(
        `[Forced Routing] Deterministic summary ${overridingGeneratedText ? 'override' : 'fallback'} succeeded (${response.length} chars)`
      );
    } else if (isDeterministicSummaryQuery(query, suggestedAgentName)) {
      const stateSummary = buildDeterministicSummaryFromCurrentState(
        query,
        suggestedAgentName
      );
      if (stateSummary) {
        response = stateSummary;
        logger.info(
          `[Forced Routing] Deterministic current-state summary override succeeded (${response.length} chars)`
        );
      }
    }

    // Summarization Fallback: if model called tools but produced no text,
    // re-run generateText without tools to summarize tool results.
    if ((!response || response.trim().length === 0) && toolsCalled.length > 0) {
      logger.warn(`[Forced Routing] ${suggestedAgentName}: Empty response with ${toolsCalled.length} tool calls — summarization fallback`);

      try {
        const uniqueResults = new Map<string, unknown>();
        for (const step of result.steps) {
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              const trOutput = extractToolResultOutput(tr);
              if (!uniqueResults.has(tr.toolName)) {
                uniqueResults.set(tr.toolName, trOutput);
              }
            }
          }
        }

        const toolResultsSummary = Array.from(uniqueResults.entries())
          .map(([name, r]) => `[${name}]: ${JSON.stringify(r).slice(0, 2000)}`)
          .join('\n\n');

        const summaryResult = await generateTextWithRetry(
          {
            messages: [
              {
                role: 'system',
                content: '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
              },
              {
                role: 'user',
                content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
              },
            ],
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
          providerOrder,
          { timeoutMs: 30000 }
        );

        if (summaryResult.success && summaryResult.result?.text) {
          response = summaryResult.result.text;
          logger.info(`[Forced Routing] Summarization fallback succeeded (${response.length} chars)`);
        }
      } catch (summaryError) {
        logger.warn(
          `[Forced Routing] Summarization fallback failed:`,
          summaryError instanceof Error ? summaryError.message : String(summaryError)
        );
      }
    }

    const sanitizedResponse = sanitizeChineseCharacters(response);
    const quality = evaluateAgentResponseQuality(
      suggestedAgentName,
      sanitizedResponse,
      { durationMs }
    );

    if (usedFallback) {
      logger.info(`[Forced Routing] Used fallback: ${attempts.map(a => a.provider).join(' → ')}`);
    }

    logger.info(
      `[Forced Routing] ${suggestedAgentName} completed in ${durationMs}ms via ${provider}, tools: [${toolsCalled.join(', ')}], ragSources: ${ragSources.length}`
    );

    return {
      success: true,
      response: sanitizedResponse,
      ragSources: ragSources.length > 0 ? ragSources : undefined,
      handoffs: [{
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason: usedFallback
          ? `Forced routing with fallback (${attempts.length} attempts)`
          : 'Forced routing (high confidence pre-filter)',
      }],
      finalAgent: suggestedAgentName,
      toolsCalled,
      usage: {
        promptTokens: result.usage?.inputTokens ?? 0,
        completionTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      metadata: {
        provider,
        modelId,
        totalRounds: attempts.length,
        handoffCount: 1,
        durationMs,
        responseChars: quality.responseChars,
        formatCompliance: quality.formatCompliance,
        qualityFlags: quality.qualityFlags,
        latencyTier: quality.latencyTier,
        providerAttempts,
        usedFallback,
        ...(fallbackReason ? { fallbackReason } : {}),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [Forced Routing] ${suggestedAgentName} failed:`, errorMessage);
    return null;
  }
}

// ============================================================================
// AgentFactory-based Execution
// ============================================================================

export function getAgentTypeFromName(agentName: string): AgentType | null {
  const mapping: Record<string, AgentType> = {
    'NLQ Agent': 'nlq',
    'Analyst Agent': 'analyst',
    'Reporter Agent': 'reporter',
    'Advisor Agent': 'advisor',
    'Vision Agent': 'vision',
    'Evaluator Agent': 'evaluator',
    'Optimizer Agent': 'optimizer',
  };
  return mapping[agentName] ?? null;
}

export async function executeWithAgentFactory(
  query: string,
  agentType: AgentType,
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  images?: ImageAttachment[],
  files?: FileAttachment[]
): Promise<MultiAgentResponse | null> {
  const agent = AgentFactory.create(agentType);

  if (!agent) {
    logger.warn(`⚠️ [AgentFactory] Agent ${agentType} not available (no model configured)`);
    return null;
  }

  const agentName = agent.getName();
  logger.info(`[AgentFactory] Executing ${agentName}...`);

  try {
    const result = await agent.run(query, {
      webSearchEnabled,
      ragEnabled,
      maxSteps: 10,
      timeoutMs: TIMEOUT_CONFIG.agent.hard,
      images,
      files,
    });

    if (!result.success) {
      logger.error(`❌ [AgentFactory] ${agentName} failed: ${result.error}`);
      return {
        success: false,
        response: `에이전트 실행 실패: ${result.error}`,
        handoffs: [{
          from: 'Orchestrator',
          to: agentName,
          reason: `AgentFactory routing - failed: ${result.error}`,
        }],
        finalAgent: agentName,
        toolsCalled: result.toolsCalled,
        usage: result.usage,
        metadata: {
          provider: result.metadata.provider,
          modelId: result.metadata.modelId,
          totalRounds: result.metadata.steps,
          handoffCount: 1,
          durationMs: Date.now() - startTime,
          responseChars: result.metadata.responseChars,
          formatCompliance: result.metadata.formatCompliance,
          qualityFlags: result.metadata.qualityFlags,
          latencyTier: result.metadata.latencyTier,
        },
      };
    }

    const durationMs = Date.now() - startTime;
    recordHandoff('Orchestrator', agentName, 'AgentFactory routing');

    return {
      success: true,
      response: result.text,
      handoffs: [{
        from: 'Orchestrator',
        to: agentName,
        reason: 'AgentFactory routing',
      }],
      finalAgent: agentName,
      toolsCalled: result.toolsCalled,
      usage: result.usage,
      metadata: {
        provider: result.metadata.provider,
        modelId: result.metadata.modelId,
        totalRounds: result.metadata.steps,
        handoffCount: 1,
        durationMs,
        responseChars: result.metadata.responseChars,
        formatCompliance: result.metadata.formatCompliance,
        qualityFlags: result.metadata.qualityFlags,
        latencyTier: result.metadata.latencyTier,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [AgentFactory] ${agentName} exception:`, errorMessage);
    return null;
  }
}
