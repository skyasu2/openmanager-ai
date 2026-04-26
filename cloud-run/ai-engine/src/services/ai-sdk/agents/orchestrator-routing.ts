/**
 * Orchestrator Routing Logic
 *
 * Model selection, Reporter Pipeline, Agent config/forced routing,
 * and AgentFactory-based execution.
 *
 * @version 4.0.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateText, hasToolCall, stepCountIs } from 'ai';
import {
  generateTextWithRetry,
  type ProviderAttempt,
} from '../../resilience/retry-with-fallback';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import {
  AGENT_NAMES,
  getAgentEvidenceBudget,
  getAgentMaxSteps as getRuntimeAgentMaxSteps,
  getAgentConfig as getNamedAgentConfig,
  getAgentProviderOrder as getRuntimeAgentProviderOrder,
  getOrchestratorProviderOrder,
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
import { getCurrentState } from '../../../data/precomputed-state';

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
import {
  createRetrievalMetadata,
  legacyRagSourcesToEvidenceCards,
  type EvidenceCard,
  type EvidenceSourceType,
  type RetrievalMetadata,
} from '../../../lib/retrieval-contract';
export { recordHandoff, getRecentHandoffs } from './orchestrator-handoff';
export { executeReporterWithPipeline } from './orchestrator-reporter-pipeline';

// ============================================================================
// Orchestrator Model (3-way fallback)
// ============================================================================

export const ORCHESTRATOR_PROVIDER_ORDER: TextProvider[] =
  getOrchestratorProviderOrder();

const SUMMARIZATION_FALLBACK_TIMEOUT_MS = 10_000;
const SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS = 768;
const SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS = 1_000;

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

export const getAgentProviderOrder = getRuntimeAgentProviderOrder;
export const getAgentMaxSteps = getRuntimeAgentMaxSteps;

interface DirectKnowledgeResultItem {
  id?: string;
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
  evidenceCards: EvidenceCard[];
  retrieval?: RetrievalMetadata;
}

interface ResourceCatalog {
  resources?: Record<string, Record<string, unknown>>;
}

interface StructuredTopologySnapshot {
  totalServers: number;
  roleCounts: Map<string, number>;
  azCounts: Map<string, number>;
  roleGroups: Array<{ role: string; serverIds: string[] }>;
  statusCounts: Record<string, number>;
  alertCount: number;
  dataSources: string[];
}

let resourceCatalogCache: ResourceCatalog | null | undefined;

const STRUCTURED_TOPOLOGY_BOUNDARY_PATTERN =
  /서버\s*(수|몇|목록|리스트|역할|role|상태|status)|몇\s*대|role|az|가용\s*영역|availability\s*zone|inventory|인벤토리/i;

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
  const sourceType = typeof value.sourceType === 'string' ? value.sourceType : 'knowledge';

  if (!title || !content) {
    return null;
  }

  return {
    ...(typeof value.id === 'string' && { id: value.id }),
    title,
    content,
    similarity,
    sourceType,
    category: typeof value.category === 'string' ? value.category : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
  };
}

function asEvidenceSourceType(value: unknown): EvidenceSourceType {
  return value === 'incident' ||
    value === 'runbook' ||
    value === 'web' ||
    value === 'knowledge'
    ? value
    : 'knowledge';
}

function asEvidenceCard(value: unknown): EvidenceCard | null {
  if (!isRecord(value)) return null;

  const title = typeof value.title === 'string' ? value.title : '';
  const summary = typeof value.summary === 'string' ? value.summary : '';
  const score = toNumber(value.score) ?? 0;

  if (!title || !summary) {
    return null;
  }

  return {
    id: typeof value.id === 'string' ? value.id : `evidence-${title}`,
    title,
    summary,
    sourceType: asEvidenceSourceType(value.sourceType),
    score: Math.min(1, Math.max(0, score)),
    ...(typeof value.category === 'string' && { category: value.category }),
    ...(typeof value.reason === 'string' && { reason: value.reason }),
    ...(typeof value.url === 'string' && { url: value.url }),
  };
}

function asRetrievalMetadata(value: unknown): RetrievalMetadata | undefined {
  if (!isRecord(value)) return undefined;

  return createRetrievalMetadata({
    retrievalEnabled: value.retrievalEnabled === true,
    retrievalUsed:
      typeof value.retrievalUsed === 'boolean'
        ? value.retrievalUsed
        : undefined,
    retrievalMode:
      value.retrievalMode === 'off' ||
      value.retrievalMode === 'lite' ||
      value.retrievalMode === 'text-only' ||
      value.retrievalMode === 'cosine-neighbor'
        ? value.retrievalMode
        : 'lite',
    evidenceCount: toNumber(value.evidenceCount) ?? 0,
    webUsed: value.webUsed === true,
    suppressedReason:
      value.suppressedReason === 'disabled' ||
      value.suppressedReason === 'not_needed' ||
      value.suppressedReason === 'no_results' ||
      value.suppressedReason === 'budget_guard' ||
      value.suppressedReason === 'unavailable'
        ? value.suppressedReason
        : undefined,
  });
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
    evidenceCards: Array.isArray(value.evidenceCards)
      ? value.evidenceCards
          .map(asEvidenceCard)
          .filter((item): item is EvidenceCard => item !== null)
      : [],
    retrieval: asRetrievalMetadata(value.retrieval),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatCountMap(map: Map<string, number>): string {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ');
}

function compactServerIds(serverIds: string[]): string {
  return serverIds.slice().sort((left, right) => left.localeCompare(right)).join(', ');
}

function loadResourceCatalog(): ResourceCatalog | null {
  if (resourceCatalogCache !== undefined) {
    return resourceCatalogCache;
  }

  const candidates = [
    // Prefer the tracked OTel SSOT so local generated copies cannot mask CI drift.
    join(process.cwd(), 'public/data/otel-data/resource-catalog.json'),
    join(process.cwd(), '..', '..', 'public/data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'cloud-run/ai-engine/data/otel-data/resource-catalog.json'),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      resourceCatalogCache = JSON.parse(
        readFileSync(filePath, 'utf-8')
      ) as ResourceCatalog;
      return resourceCatalogCache;
    } catch (error) {
      logger.warn(
        `[Forced Routing] Failed to parse resource catalog ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  resourceCatalogCache = null;
  return null;
}

function buildStructuredTopologySnapshot(): StructuredTopologySnapshot | null {
  const catalog = loadResourceCatalog();
  const resources = catalog?.resources;
  if (!resources || Object.keys(resources).length === 0) {
    return null;
  }

  const roleCounts = new Map<string, number>();
  const azCounts = new Map<string, number>();
  const roleGroups = new Map<string, string[]>();

  for (const [serverId, attrs] of Object.entries(resources)) {
    const role = readString(attrs['server.role']) ?? 'unknown';
    const az = readString(attrs['cloud.availability_zone']) ?? 'unknown';
    incrementCount(roleCounts, role);
    incrementCount(azCounts, az);
    roleGroups.set(role, [...(roleGroups.get(role) ?? []), serverId]);
  }

  const currentState = getCurrentState();
  const statusCounts = currentState.servers.reduce<Record<string, number>>(
    (acc, server) => {
      acc[server.status] = (acc[server.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return {
    totalServers: Object.keys(resources).length,
    roleCounts,
    azCounts,
    roleGroups: [...roleGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([role, serverIds]) => ({ role, serverIds: serverIds.sort() })),
    statusCounts,
    alertCount: currentState.alerts.length,
    dataSources: ['otel-resource-catalog', 'precomputed-state'],
  };
}

function isStructuredTopologyBoundaryQuery(query: string): boolean {
  return STRUCTURED_TOPOLOGY_BOUNDARY_PATTERN.test(query);
}

function buildStructuredTopologyBoundaryResponse(
  query: string,
  startTime: number,
  suggestedAgentName: string,
  ragEnabled: boolean
): MultiAgentResponse | null {
  const snapshot = buildStructuredTopologySnapshot();
  if (!snapshot) return null;

  const roleGroupLines = snapshot.roleGroups
    .map(({ role, serverIds }) => `- ${role}: ${compactServerIds(serverIds)}`)
    .join('\n');
  const statusSummary = Object.entries(snapshot.statusCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
  const response = sanitizeChineseCharacters(
    [
      '### 인프라 구조화 상태 요약',
      `- 질의: ${query}`,
      `- 총 서버 수: ${snapshot.totalServers}대`,
      `- 역할 분포: ${formatCountMap(snapshot.roleCounts)}`,
      `- AZ 분포: ${formatCountMap(snapshot.azCounts)}`,
      `- 현재 상태 요약: ${statusSummary || '상태 데이터 없음'}`,
      `- 현재 알림 수: ${snapshot.alertCount}건`,
      '',
      '#### 역할별 서버',
      roleGroupLines,
      '',
      '#### 근거 경계',
      '- 서버 수, 역할, AZ, 현재 상태는 RAG 문서가 아니라 구조화된 OTel resource catalog와 precomputed metrics state를 정본으로 사용했습니다.',
      '- 운영 절차나 장애 대응 방법이 필요하면 내부 지식 검색을 보조 근거로 별도 사용합니다.',
    ].join('\n')
  );
  const durationMs = Date.now() - startTime;
  const quality = evaluateAgentResponseQuality(suggestedAgentName, response, {
    durationMs,
  });

  return {
    success: true,
    response,
    evidenceCards: [
      {
        id: 'structured-topology-current-state',
        title: 'Structured topology and current metrics state',
        summary: `${snapshot.totalServers} servers from resource catalog; current status from precomputed state.`,
        sourceType: 'knowledge',
        score: 1,
        category: 'structured-topology',
        reason: `structured-evidence:${snapshot.dataSources.join('+')}`,
      },
    ],
    handoffs: [
      {
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason: 'Forced routing (structured topology boundary)',
      },
    ],
    finalAgent: suggestedAgentName,
    toolsCalled: ['structuredTopologyLookup', 'finalAnswer'],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    metadata: {
      provider: 'deterministic',
      modelId: 'structured-topology-state',
      totalRounds: 1,
      handoffCount: 1,
      durationMs,
      responseChars: quality.responseChars,
      formatCompliance: quality.formatCompliance,
      qualityFlags: quality.qualityFlags,
      latencyTier: quality.latencyTier,
      retrieval: createRetrievalMetadata({
        retrievalEnabled: ragEnabled,
        retrievalUsed: false,
        retrievalMode: 'lite',
        evidenceCount: 0,
        suppressedReason: 'not_needed',
        webUsed: false,
      }),
    },
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
    knowledge: results.filter((item) => item.sourceType === 'knowledge').length,
    incident: results.filter((item) => item.sourceType === 'incident').length,
    runbook: results.filter((item) => item.sourceType === 'runbook').length,
    web: results.filter((item) => item.sourceType === 'web').length,
  };
  const serverCountHint = extractServerCountHint(results);
  const titleBullets = topResults
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join('\n');

  return [
    '### 인프라 토폴로지 요약',
    `- 질의: ${query}`,
    `- 근거 문서: ${results.length}건 (운영 지식 ${sourceSummary.knowledge}, 장애 이력 ${sourceSummary.incident}, 런북 ${sourceSummary.runbook}, 웹 ${sourceSummary.web})`,
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
  const evidenceBudget = getAgentEvidenceBudget(suggestedAgentName);
  logger.info(`[Forced Routing] Using retry with fallback: [${providerOrder.join(' → ')}]`);

  let filteredTools = filterToolsByWebSearch(agentConfig.tools, webSearchEnabled);
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);
  const isForceKnowledgeBaseQuery = FORCE_KB_QUERY_PATTERN.test(query);
  const forceKnowledgeBaseTool =
    ragEnabled &&
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    'searchKnowledgeBase' in filteredTools;

  if (
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    isStructuredTopologyBoundaryQuery(query)
  ) {
    const structuredTopologyResponse = buildStructuredTopologyBoundaryResponse(
      query,
      startTime,
      suggestedAgentName,
      ragEnabled
    );
    if (structuredTopologyResponse) {
      logger.info(
        '[Forced Routing] Structured topology boundary path succeeded without RAG document lookup'
      );
      return structuredTopologyResponse;
    }
  }

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
          const directEvidence = parsedDirectResult.results.slice(
            0,
            evidenceBudget
          );
          const directEvidenceCards =
            parsedDirectResult.evidenceCards.length > 0
              ? parsedDirectResult.evidenceCards.slice(0, evidenceBudget)
              : legacyRagSourcesToEvidenceCards(
                  directEvidence.map((item) => ({
                    title: item.title,
                    similarity: item.similarity,
                    sourceType: item.sourceType,
                    category: item.category,
                    url: item.url,
                  }))
                );
          const directRetrieval = createRetrievalMetadata({
            retrievalEnabled: true,
            retrievalUsed: directEvidenceCards.length > 0,
            retrievalMode: parsedDirectResult.retrieval?.retrievalMode ?? 'lite',
            evidenceCount: directEvidenceCards.length,
            webUsed: directEvidence.some((item) => item.sourceType === 'web'),
            suppressedReason:
              directEvidenceCards.length > 0
                ? undefined
                : parsedDirectResult.retrieval?.suppressedReason ?? 'no_results',
          });
          const durationMs = Date.now() - startTime;
          const response = sanitizeChineseCharacters(
            buildTopologyDirectKnowledgeResponse(query, directEvidence)
          );
          const quality = evaluateAgentResponseQuality('Advisor Agent', response, { durationMs });

          logger.info(
            `[Forced Routing] Topology direct KB path succeeded in ${durationMs}ms (${directEvidence.length} docs)`
          );

          return {
            success: true,
            response,
            ragSources: directEvidence.map((item) => ({
              title: item.title,
              similarity: item.similarity,
              sourceType: item.sourceType,
              category: item.category,
              url: item.url,
            })),
            evidenceCards: directEvidenceCards,
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
              retrieval: directRetrieval,
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
    const evidenceCards: EvidenceCard[] = [];
    let retrievalMetadata: RetrievalMetadata | undefined;
    let knowledgeRetrievalAttempted = false;
    const pushRagSource = (source: (typeof ragSources)[number]) => {
      if (ragSources.length < evidenceBudget) {
        ragSources.push(source);
      }
    };
    const pushEvidenceCard = (card: EvidenceCard) => {
      if (evidenceCards.length < evidenceBudget) {
        evidenceCards.push(card);
      }
    };

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
            knowledgeRetrievalAttempted = true;
            const kbResult = trOutput as Record<string, unknown>;
            if (Array.isArray(kbResult.evidenceCards)) {
              for (const card of kbResult.evidenceCards) {
                const parsedCard = asEvidenceCard(card);
                if (parsedCard) {
                  pushEvidenceCard(parsedCard);
                }
              }
            }
            retrievalMetadata = asRetrievalMetadata(kbResult.retrieval) ?? retrievalMetadata;
            const similarCases = (kbResult.similarCases ?? kbResult.results) as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(similarCases)) {
              for (const doc of similarCases) {
                pushRagSource({
                  title: String(doc.title ?? doc.name ?? 'Unknown'),
                  similarity: Number(doc.similarity ?? doc.score ?? 0),
                  sourceType: String(doc.sourceType ?? doc.type ?? 'knowledge'),
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
                pushRagSource({
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
      logger.warn(
        `[Forced Routing] ${suggestedAgentName}: Empty response with ${toolsCalled.length} tool calls — summarization fallback`
      );

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
          .map(
            ([name, r]) =>
              `[${name}]: ${JSON.stringify(r).slice(0, SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS)}`
          )
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
            maxOutputTokens: SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS,
          },
          providerOrder,
          { timeoutMs: SUMMARIZATION_FALLBACK_TIMEOUT_MS }
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
    const resolvedEvidenceCards =
      evidenceCards.length > 0
        ? evidenceCards
        : knowledgeRetrievalAttempted && ragSources.length > 0
          ? legacyRagSourcesToEvidenceCards(ragSources.slice(0, evidenceBudget))
          : [];
    const resolvedRetrievalMetadata = knowledgeRetrievalAttempted
      ? createRetrievalMetadata({
          retrievalEnabled: true,
          retrievalUsed: resolvedEvidenceCards.length > 0,
          retrievalMode: retrievalMetadata?.retrievalMode ?? 'lite',
          evidenceCount: resolvedEvidenceCards.length,
          webUsed:
            retrievalMetadata?.webUsed ??
            ragSources.some((item) => item.sourceType === 'web'),
          suppressedReason:
            resolvedEvidenceCards.length > 0
              ? undefined
              : retrievalMetadata?.suppressedReason ?? 'no_results',
        })
      : undefined;

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
      evidenceCards:
        resolvedEvidenceCards.length > 0 ? resolvedEvidenceCards : undefined,
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
        ...(resolvedRetrievalMetadata && {
          retrieval: resolvedRetrievalMetadata,
        }),
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
      maxSteps: getAgentMaxSteps(agentName),
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
        ...(result.ragSources && { ragSources: result.ragSources }),
        ...(result.evidenceCards && { evidenceCards: result.evidenceCards }),
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
          ...(result.metadata.retrieval && {
            retrieval: result.metadata.retrieval,
          }),
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
      ...(result.ragSources && { ragSources: result.ragSources }),
      ...(result.evidenceCards && { evidenceCards: result.evidenceCards }),
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
        ...(result.metadata.retrieval && {
          retrieval: result.metadata.retrieval,
        }),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [AgentFactory] ${agentName} exception:`, errorMessage);
    return null;
  }
}
