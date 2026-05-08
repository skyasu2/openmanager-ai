/**
 * Supervisor Routing Logic
 *
 * Mode selection, intent classification, and prepareStep for runtime tool filtering.
 */

import type { ToolName } from '../../tools-ai-sdk';
import type {
  AnalysisMode,
  SupervisorMode,
} from '../../services/ai-sdk/supervisor-types';
import { getMonitoringResourceCatalog } from './resource-catalog';
import { createMonitoringSystemPrompt } from './supervisor-prompt';
import { isTavilyAvailable } from '../../lib/tavily-hybrid-rag';
import { logger } from '../../lib/logger';
import { classifyQueryIntent } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  ADVISOR_QUERY_PATTERN,
  COMPOSITE_QUERY_PATTERNS,
  FORCE_KB_QUERY_PATTERN,
  INFRA_CONTEXT_PATTERN,
  REPORTER_QUERY_PATTERN,
  isFormattingOnlyReportRequest,
} from '../../services/ai-sdk/query-routing-signals';

export function createSystemPrompt(deviceType?: string): string {
  return createMonitoringSystemPrompt(deviceType);
}

// ============================================================================
// Retry Configuration
// ============================================================================

export const RETRY_CONFIG = {
  maxRetries: 2,
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'MODEL_ERROR'],
  retryDelayMs: 1000,
};

// ============================================================================
// Mode Selection Logic
// ============================================================================

export function selectExecutionMode(
  query: string,
  analysisMode?: AnalysisMode
): SupervisorMode {
  const q = query.toLowerCase();
  const hasInfraContext = INFRA_CONTEXT_PATTERN.test(q);

  if (isFormattingOnlyReportRequest(q)) {
    return 'single';
  }

  if (analysisMode === 'thinking' && hasInfraContext) {
    return 'multi';
  }

  if (FORCE_KB_QUERY_PATTERN.test(q)) {
    return 'multi';
  }

  const multiAgentPatterns = [
    REPORTER_QUERY_PATTERN,
    /report|장애.*보고|일일.*리포트/i,
    /분석.*원인|원인.*분석|근본.*원인|rca|root.*cause/i,
    ADVISOR_QUERY_PATTERN,
    /유사.*장애|대응.*방안/i,
    /how.*to.*(fix|resolve|solve)|troubleshoot|trubleshoot/i,
    /용량.*계획|capacity|언제.*부족|얼마나.*남|증설.*필요/i,
    /(서버|서벼|썹|상태|현황|모니터링|인프라).*(요약|요먁|간단히|핵심|tl;?dr)/i,
    /(요약|요먁|간단히|핵심|tl;?dr).*(서버|서벼|썹|상태|현황|알려|해줘)/i,
    /(server|servr|sever|status|monitoring).*(summary|sumary|summry|summarize|brief|overview)/i,
    /(summary|sumary|summry|summarize|overview).*(server|servr|sever|status|all)/i,
    /전체.*(서버|서벼|썹).*분석|모든.*(서버|서벼|썹).*상태|(서버|서벼|썹).*전반|종합.*분석/i,
    /all.*(server|servr|sever)s?.*status|overall.*status|system.*overview/i,
  ];

  const contextGatedPatterns = [
    /왜.*(느려|높아|이상|스파이크|지연|오류|급증)/i,
    /why.*(high|slow|spik|error|increas|drop|fail)/i,
    /what.*caused|reason.*for/i,
    /예측|트렌드|추세|추이|변화.*패턴|임계치.*전|넘기\s*전|미리.*알|고갈/i,
    /predict|forecast|trend.*analysis/i,
    /어제.*대비|지난.*주.*대비|전월.*대비|작년.*비교/i,
    /compared.*to.*(yesterday|last|previous)/i,
    /상관관계|연관.*분석|correlat|같이.*올라|함께.*증가/i,
    /이상.*원인|비정상.*이유|스파이크.*원인|급증.*이유/i,
    /이상\s*(탐지|감지|확인|점검|있어|있나)|비정상|고장난|느린|안\s*되는/i,
    /(명령어|cli|커맨드|command).*(추천|알려|확인|점검)|(추천|알려).*(명령어|cli|커맨드|command)|순서|재마운트|해야/i,
  ];

  const compositeConnectors = [
    COMPOSITE_QUERY_PATTERNS[0],
    COMPOSITE_QUERY_PATTERNS[1],
  ];

  const compositeIntentPatterns = [
    /상태.*원인|원인.*상태/i,
    COMPOSITE_QUERY_PATTERNS[2],
    /요약.*보고서|보고서.*요약|분석.*보고서|보고서.*분석/i,
  ];

  for (const pattern of multiAgentPatterns) {
    if (pattern.test(q)) {
      return 'multi';
    }
  }

  if (hasInfraContext) {
    for (const pattern of contextGatedPatterns) {
      if (pattern.test(q)) {
        return 'multi';
      }
    }

    const connectorHits = compositeConnectors.filter((pattern) => pattern.test(q)).length;
    const intentHits = compositeIntentPatterns.filter((pattern) => pattern.test(q)).length;

    if (intentHits >= 1 || connectorHits >= 2 || (connectorHits >= 1 && q.length >= 50)) {
      return 'multi';
    }
  }

  return 'single';
}

// ============================================================================
// Intent Classification & prepareStep (SSOT)
// ============================================================================

export type IntentCategory = 'anomaly' | 'prediction' | 'math' | 'rca' | 'advisor' | 'serverGroup' | 'logs' | 'metrics' | 'general';

const TOOL_ROUTING_PATTERNS = {
  anomaly: /이상|급증|급감|스파이크|anomal|탐지|감지|비정상/i,
  prediction: /예측|트렌드|추이|전망|forecast|추세|임계치.*전|넘기\s*전|미리.*알|고갈/i,
  rca: /장애|rca|타임라인|상관관계|원인|왜|근본|incident/i,
  math: /(?:계산|연산|수식|중앙값|표준편차|percentile|p\d{2}|증가율|성장률|지수|루트|\d+(?:\.\d+)?\s*(?:[+*\/\^]|\s-\s)\s*\d+)/i,
  advisor:
    /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|재마운트|remount|troubleshoot|이력|과거|사례|검색|보안|강화|백업|최적화|best.?practice|권장|추천|토폴로지|아키텍처|구성도|topology|architecture/i,
  serverGroup: /(db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지)\s*(서버)?/i,
  logs: /로그(?!인)|(?<![a-z])logs?(?![a-z])|에러\s*로그|syslog|journalctl|dmesg|시스템\s*로그/i,
  metrics: /cpu|메모리|디스크|서버|상태|memory|disk/i,
} as const;

export function getIntentCategory(query: string): IntentCategory {
  const q = query.toLowerCase();

  if (TOOL_ROUTING_PATTERNS.anomaly.test(q)) return 'anomaly';
  if (TOOL_ROUTING_PATTERNS.prediction.test(q)) return 'prediction';
  if (TOOL_ROUTING_PATTERNS.math.test(q)) return 'math';
  if (TOOL_ROUTING_PATTERNS.rca.test(q)) return 'rca';
  if (TOOL_ROUTING_PATTERNS.advisor.test(q)) return 'advisor';
  if (TOOL_ROUTING_PATTERNS.logs.test(q)) return 'logs';
  if (TOOL_ROUTING_PATTERNS.serverGroup.test(q)) return 'serverGroup';
  if (TOOL_ROUTING_PATTERNS.metrics.test(q)) return 'metrics';
  return 'general';
}

const SIMPLE_CONVERSATION_PATTERNS = /^(안녕|감사|고마워|잘했어|hi|hello|thanks|thank you|bye|잘가)[\s!?.]*$/i;
const CURRENT_METRIC_VALUE_PATTERNS =
  /(사용률|몇\s*%|몇퍼센트|퍼센트|얼마|수치|값|상태|어때|어떻|알려|보여|확인|usage|percent|percentage|status)/i;
const NON_CURRENT_METRIC_PATTERNS =
  /(지난|최근|평균|최대|최소|합계|추세|트렌드|예측|비교|대비|변화|last1h|last6h|last24h|last\s+\d+\s*h|avg|max|min|trend|forecast|compare)/i;
const BEST_EFFORT_GENERAL_PATTERNS =
  /(날씨|weather|운세|horoscope|뉴스|news|환율|exchange\s*rate|주가|stock\s*price|시세|가격|비트코인|btc|맛집|restaurant|번역|translate|일정|calendar)/i;
const REALTIME_GENERAL_WEB_PATTERNS =
  /(날씨|weather|뉴스|news|환율|exchange\s*rate|주가|stock\s*price|시세|가격|비트코인|btc|오늘|today|내일|tomorrow|이번주|this\s*week)/i;
/**
 * 웹 검색을 강제해야 하는 쿼리인지 판별.
 * 사용자가 토글 ON + 이 함수가 true → step 0에서 searchWeb 강제 호출.
 * 쿼타 보호: 내부 모니터링 쿼리는 강제하지 않음.
 */
export function shouldForceWebSearch(query: string): boolean {
  const q = query.toLowerCase();
  const FORCE_INDICATORS = [
    '최신', 'latest', '2024', '2025', '2026',
    'stable',
    'cve', 'security advisory', '보안 취약점',
    '공식 문서', 'documentation',
    '릴리스', 'release', '버전', 'version',
  ];
  return (
    FORCE_INDICATORS.some((kw) => q.includes(kw)) ||
    (!INFRA_CONTEXT_PATTERN.test(q) && REALTIME_GENERAL_WEB_PATTERNS.test(q))
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildServerIdPattern(): RegExp {
  try {
    const resources = getMonitoringResourceCatalog()?.resources;
    const serverIds = resources ? Object.keys(resources) : [];
    if (serverIds.length > 0) {
      return new RegExp(`\\b(?:${serverIds.map(escapeRegExp).join('|')})\\b`, 'i');
    }
  } catch {
    // Fallback below keeps routing available when local catalog files are absent.
  }

  return /\b[a-z][-a-z0-9]*-(?:dc|zone|region|prod|staging)\d*[-a-z0-9]*\b/i;
}

let serverIdPattern: RegExp | null = null;

function getServerIdPattern(): RegExp {
  serverIdPattern ??= buildServerIdPattern();
  return serverIdPattern;
}

function shouldForceRealtimeServerMetricTool(query: string): boolean {
  const q = query.toLowerCase();

  return (
    getServerIdPattern().test(q) &&
    TOOL_ROUTING_PATTERNS.metrics.test(q) &&
    CURRENT_METRIC_VALUE_PATTERNS.test(q) &&
    !NON_CURRENT_METRIC_PATTERNS.test(q)
  );
}

function shouldForceMetricRankingTool(query: string): boolean {
  const q = query.toLowerCase();
  const { intent } = classifyQueryIntent(query);

  return (
    intent === 'data-ranking' &&
    !NON_CURRENT_METRIC_PATTERNS.test(q) &&
    !getServerIdPattern().test(q)
  );
}

function shouldForceKnowledgeBaseTool(query: string): boolean {
  return FORCE_KB_QUERY_PATTERN.test(query.toLowerCase());
}

function isBestEffortGeneralQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (INFRA_CONTEXT_PATTERN.test(q)) return false;
  if (FORCE_KB_QUERY_PATTERN.test(q)) return false;
  return getIntentCategory(q) === 'general' || BEST_EFFORT_GENERAL_PATTERNS.test(q);
}

export function createPrepareStep(
  query: string,
  options?: {
    enableWebSearch?: boolean;
    enableRAG?: boolean;
  }
) {
  const q = query.toLowerCase();
  const webSearchEnabled = options?.enableWebSearch === true;
  const ragEnabled = options?.enableRAG === true;

  return async ({ stepNumber }: { stepNumber: number }) => {
    if (SIMPLE_CONVERSATION_PATTERNS.test(query.trim())) {
      logger.debug('[PrepareStep] Simple conversation detected, toolChoice: none');
      return { toolChoice: 'none' as const };
    }

    if (isFormattingOnlyReportRequest(q)) {
      return {
        activeTools: ['finalAnswer'] as ToolName[],
        toolChoice: 'required' as const,
      };
    }

    const shouldForceRealtimeMetric = shouldForceRealtimeServerMetricTool(q);
    const shouldForceMetricRanking = shouldForceMetricRankingTool(q);
    const shouldForceKnowledgeBase = ragEnabled && shouldForceKnowledgeBaseTool(q);
    const shouldForceWeb = webSearchEnabled && shouldForceWebSearch(q);
    const isGeneralBestEffort = isBestEffortGeneralQuery(q);

    if (shouldForceMetricRanking) {
      logger.debug(
        '[PrepareStep] Metric ranking query detected, forcing getServerMetricsAdvanced'
      );
      if (stepNumber > 0) {
        return {
          activeTools: ['finalAnswer'] as ToolName[],
          toolChoice: 'required' as const,
        };
      }

      return {
        activeTools: ['getServerMetricsAdvanced', 'finalAnswer'] as ToolName[],
        toolChoice: {
          type: 'tool',
          toolName: 'getServerMetricsAdvanced',
        } as const,
      };
    }

    if (shouldForceRealtimeMetric) {
      logger.debug('[PrepareStep] Direct realtime server metric query detected, forcing getServerMetrics');
      if (stepNumber > 0) {
        return {
          activeTools: ['finalAnswer'] as ToolName[],
          toolChoice: 'required' as const,
        };
      }

      return {
        activeTools: ['getServerMetrics', 'finalAnswer'] as ToolName[],
        toolChoice: { type: 'tool', toolName: 'getServerMetrics' } as const,
      };
    }

    if (isGeneralBestEffort) {
      if (shouldForceWeb && stepNumber === 0 && isTavilyAvailable()) {
        return {
          activeTools: ['searchWeb', 'finalAnswer'] as ToolName[],
          toolChoice: { type: 'tool', toolName: 'searchWeb' } as const,
        };
      }

      return {
        activeTools: ['finalAnswer'] as ToolName[],
        toolChoice: 'required' as const,
      };
    }

    // ── Step 1: 패턴 라우팅 — 쿼리 의도에 맞는 기본 도구 세트 결정 ──
    let activeTools: ToolName[];
    let toolChoice: 'auto' | 'required' | { type: 'tool'; toolName: string };

    if (TOOL_ROUTING_PATTERNS.anomaly.test(q)) {
      activeTools = ['detectAnomalies', 'predictTrends', 'analyzePattern', 'getServerMetrics', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.math.test(q)) {
      activeTools = ['evaluateMathExpression', 'computeSeriesStats', 'estimateCapacityProjection', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.prediction.test(q)) {
      activeTools = ['predictTrends', 'analyzePattern', 'detectAnomalies', 'correlateMetrics', 'estimateCapacityProjection', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.rca.test(q)) {
      activeTools = ['findRootCause', 'buildIncidentTimeline', 'correlateMetrics', 'getServerMetrics', 'detectAnomalies', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.advisor.test(q)) {
      activeTools = ['recommendCommands', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.logs.test(q)) {
      activeTools = ['getServerLogs', 'getServerMetrics', 'filterServers', 'finalAnswer'];
      toolChoice = 'required';
    } else if (TOOL_ROUTING_PATTERNS.serverGroup.test(q)) {
      activeTools = ['getServerByGroup', 'getServerByGroupAdvanced', 'filterServers', 'finalAnswer'];
      toolChoice = 'auto';
    } else {
      activeTools = ['getServerMetrics', 'getServerMetricsAdvanced', 'filterServers', 'getServerByGroup', 'finalAnswer'];
      toolChoice = 'auto';
    }

    // ── Step 2: Route-then-Augment — 사용자 토글에 따라 도구 주입/제거 ──
    const finalAnswerIdx = activeTools.indexOf('finalAnswer');

    // Web Search: ON이면 주입, OFF이면 제거
    if (webSearchEnabled && isTavilyAvailable()) {
      if (!activeTools.includes('searchWeb')) {
        activeTools.splice(finalAnswerIdx, 0, 'searchWeb');
      }
    } else {
      activeTools = activeTools.filter((t) => t !== 'searchWeb');
      if (webSearchEnabled) {
        logger.warn('[PrepareStep] Web search requested but Tavily unavailable');
      }
    }

    // RAG: ON이면 주입, OFF이면 제거
    if (ragEnabled) {
      if (!activeTools.includes('searchKnowledgeBase')) {
        const idx = activeTools.indexOf('finalAnswer');
        activeTools.splice(idx, 0, 'searchKnowledgeBase');
      }
    } else {
      activeTools = activeTools.filter((t) => t !== 'searchKnowledgeBase');
    }

    // ── Step 3: KB 검색 강제 — topology/architecture 질의는 모델 추정보다 KB를 우선 ──
    if (shouldForceKnowledgeBase && stepNumber > 0) {
      activeTools = activeTools.filter((toolName) => toolName !== 'searchKnowledgeBase');
    }

    if (
      shouldForceWeb &&
      stepNumber > 0 &&
      activeTools.includes('searchWeb')
    ) {
      activeTools = activeTools.filter((toolName) => toolName !== 'searchWeb');
    }

    if (
      shouldForceKnowledgeBase &&
      activeTools.includes('searchKnowledgeBase') &&
      stepNumber === 0
    ) {
      toolChoice = { type: 'tool', toolName: 'searchKnowledgeBase' };
    }

    // ── Step 4: 웹 검색 강제 — 사용자 토글 ON + 외부 정보 필요 쿼리 시 강제 호출 ──
    if (shouldForceWeb && activeTools.includes('searchWeb') && stepNumber === 0) {
      toolChoice = { type: 'tool', toolName: 'searchWeb' };
    }

    return { activeTools, toolChoice };
  };
}
