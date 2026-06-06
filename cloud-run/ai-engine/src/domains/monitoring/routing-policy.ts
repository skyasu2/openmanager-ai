/**
 * Supervisor Routing Logic
 *
 * Mode selection, intent classification, and prepareStep for runtime tool filtering.
 */

import type { ToolName } from '../../tools-ai-sdk';
import type {
  AssistantInputType,
  DomainIntentFrame,
} from '../../core/assistant-runtime';
import type { SupervisorMode } from '../../services/ai-sdk/supervisor-types';
import { getMonitoringResourceCatalog } from './resource-catalog';
import { createMonitoringSystemPrompt } from './supervisor-prompt';
import { isTavilyAvailable } from '../../lib/tavily-web-search-client';
import { logger } from '../../lib/logger';
import { classifyQueryIntent } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  resolveMonitoringToolPolicy,
  type MonitoringToolIntent,
} from '../../services/ai-sdk/agents/config/monitoring-tool-policy';
import {
  ADVISOR_QUERY_PATTERN,
  FORCE_KB_QUERY_PATTERN,
  INFRA_CONTEXT_PATTERN,
  REPORTER_QUERY_PATTERN,
  isFormattingOnlyReportRequest,
  extractQueryRoutingSignals,
  shouldPreferAdvisorForOperationalAdvice,
} from '../../services/ai-sdk/routing/query-routing-signals';
import { createRoutingDecisionTrace } from '../../services/ai-sdk/routing/routing-decision-trace';
import { CAPACITY_FULL_FORECAST_PATTERN } from '../../services/ai-sdk/routing/routing-patterns';
import { resolveMonitoringSemanticFrameRoute } from '../../services/ai-sdk/routing/semantic-frame-policy';
import { METRIC_TREND_RANKING_PATTERN } from './current-metrics-evidence-patterns';

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

const INTENT_FRAME_EXECUTION_MODE_CONFIDENCE = 0.8;
const INTENT_FRAME_CATEGORY_CONFIDENCE = 0.75;

function normalizeIntentFrameConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return confidence > 1 ? confidence / 100 : confidence;
}

function resolveIntentFrameExecutionMode(
  intentFrame?: DomainIntentFrame
): Exclude<SupervisorMode, 'auto'> | undefined {
  if (!intentFrame || intentFrame.executionMode === 'unknown') return undefined;

  const confidence = normalizeIntentFrameConfidence(intentFrame.confidence);
  if (confidence < INTENT_FRAME_EXECUTION_MODE_CONFIDENCE) return undefined;

  return intentFrame.executionMode;
}

const CAPACITY_FORECAST_MODE_PATTERNS =
  /(?:cpu|씨피유|메모리|mem|memori|memroy|memory|디스크|disk|스토리지|storage|네트워크|network|용량).{0,40}(?:언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파).{0,24}(?:시점|예측)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?|용량\s*(?:예측|계획|부족|고갈)|임계(?:치|값)?.{0,24}(?:초과|도달|넘|시점)|고갈|포화|saturat(?:e|ion)|run\s*out|full\s*capacity)|(?:언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?).{0,40}(?:cpu|씨피유|메모리|mem|memori|memroy|memory|디스크|disk|스토리지|storage|네트워크|network|용량)/i;

export function selectExecutionMode(
  query: string,
  intentFrame?: DomainIntentFrame,
  inputType?: AssistantInputType
): SupervisorMode {
  void createRoutingDecisionTrace(extractQueryRoutingSignals(query));

  const q = query.toLowerCase();

  if (inputType === 'log_paste') {
    return 'multi';
  }

  if (isFormattingOnlyReportRequest(q)) {
    return 'single';
  }

  if (FORCE_KB_QUERY_PATTERN.test(q)) {
    return 'multi';
  }

  if (
    CAPACITY_FORECAST_MODE_PATTERNS.test(q) ||
    CAPACITY_FULL_FORECAST_PATTERN.test(q)
  ) {
    return 'multi';
  }

  if (shouldPreferAdvisorForOperationalAdvice(q)) {
    return 'multi';
  }

  const frameMode = resolveIntentFrameExecutionMode(intentFrame);
  if (frameMode) {
    return frameMode;
  }

  const fallbackMultiPatterns = [
    REPORTER_QUERY_PATTERN,
    ADVISOR_QUERY_PATTERN,
  ];

  for (const pattern of fallbackMultiPatterns) {
    if (pattern.test(q)) {
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
  prediction: /예측|트렌드|추이|전망|forecast|추세|언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파).{0,24}(?:언제|시점|예측)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?|임계(?:치|값)?.*(?:전|넘|초과|도달)|넘기\s*전|미리.*알|고갈|포화|saturat(?:e|ion)|run\s*out/i,
  rca: /장애|rca|root\s*cause|타임라인|상관관계|원인|왜|이유|때문|근본|incident|\bwhy\b|\breason\b|\bcause\b/i,
  math: /(?:계산|연산|수식|중앙값|표준편차|percentile|p\d{2}|지수|루트|\d+(?:\.\d+)?\s*(?:[+*\/\^]|\s-\s)\s*\d+)/i,
  advisor:
    /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|재마운트|remount|troubleshoot|이력|과거|사례|검색|보안|강화|백업|최적화|best.?practice|권장|추천|토폴로지|아키텍처|구성도|topology|architecture/i,
  serverGroup: /(db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지)\s*(서버)?/i,
  logs: /로그(?!인)|(?<![a-z])logs?(?![a-z])|에러\s*로그|syslog|journalctl|dmesg|시스템\s*로그/i,
  metrics: /cpu|메모리|디스크|서버|상태|memory|memori|memroy|disk|부하|로드|load|az|구역|zone|location|위치|균형|balance/i,
} as const;

function resolveIntentFrameCategory(
  intentFrame?: DomainIntentFrame
): IntentCategory | undefined {
  if (!intentFrame) return undefined;

  const confidence = normalizeIntentFrameConfidence(intentFrame.confidence);
  if (confidence < INTENT_FRAME_CATEGORY_CONFIDENCE) return undefined;

  const semanticRoute = resolveMonitoringSemanticFrameRoute(intentFrame);
  if (!semanticRoute) return undefined;

  if (semanticRoute.category === 'server_health') {
    return intentFrame.scope === 'group' ? 'serverGroup' : 'metrics';
  }

  return semanticRoute.category;
}

export function getIntentCategory(
  query: string,
  intentFrame?: DomainIntentFrame
): IntentCategory {
  void createRoutingDecisionTrace(extractQueryRoutingSignals(query));

  const q = query.toLowerCase();
  if (FORCE_KB_QUERY_PATTERN.test(q)) return 'advisor';

  const semanticCategory = resolveIntentFrameCategory(intentFrame);
  if (
    semanticCategory &&
    !(
      semanticCategory === 'metrics' &&
      shouldPreferAdvisorForOperationalAdvice(q)
    )
  ) {
    return semanticCategory;
  }

  if (TOOL_ROUTING_PATTERNS.anomaly.test(q)) return 'anomaly';
  if (
    TOOL_ROUTING_PATTERNS.prediction.test(q) ||
    CAPACITY_FULL_FORECAST_PATTERN.test(q)
  ) return 'prediction';
  if (TOOL_ROUTING_PATTERNS.math.test(q)) return 'math';
  if (TOOL_ROUTING_PATTERNS.rca.test(q)) return 'rca';
  if (shouldPreferAdvisorForOperationalAdvice(q)) return 'advisor';
  if (TOOL_ROUTING_PATTERNS.advisor.test(q)) return 'advisor';
  if (TOOL_ROUTING_PATTERNS.logs.test(q)) return 'logs';
  if (TOOL_ROUTING_PATTERNS.serverGroup.test(q)) return 'serverGroup';
  if (TOOL_ROUTING_PATTERNS.metrics.test(q)) return 'metrics';
  return 'general';
}

// ============================================================================
// Intent-Specific LLM Parameters
// ============================================================================

/**
 * Return intent-specific LLM parameters for improved response quality.
 *
 * - Metric queries: low temperature (0.1) for factual accuracy, shorter output
 * - Analysis/RCA:  moderate temperature (0.3) with longer output for depth
 * - Reports:       moderate temperature (0.25) with maximum output for completeness
 * - General:       slightly higher temperature (0.5) for natural conversation
 */
export function getLLMParamsForIntent(intent: IntentCategory): {
  temperature: number;
  maxOutputTokens: number;
} {
  switch (intent) {
    case 'metrics':
    case 'serverGroup':
    case 'logs':
    case 'math':
      return { temperature: 0.1, maxOutputTokens: 1536 };
    case 'anomaly':
    case 'prediction':
      return { temperature: 0.3, maxOutputTokens: 2560 };
    case 'rca':
      return { temperature: 0.25, maxOutputTokens: 3072 };
    case 'advisor':
      return { temperature: 0.3, maxOutputTokens: 2560 };
    case 'general':
      return { temperature: 0.5, maxOutputTokens: 2048 };
    default:
      return { temperature: 0.3, maxOutputTokens: 2048 };
  }
}

const SIMPLE_CONVERSATION_PATTERNS = /^(안녕|감사|고마워|잘했어|hi|hello|thanks|thank you|bye|잘가)[\s!?.]*$/i;
const CURRENT_METRIC_VALUE_PATTERNS =
  /(사용률|몇\s*%|몇퍼센트|퍼센트|얼마|수치|값|상태|어때|어떻|알려|보여|확인|usage|percent|percentage|status)/i;
const NON_CURRENT_METRIC_PATTERNS =
  /(지난|최근|평균|최대|최소|합계|추세|트렌드|예측|비교|대비|변화|last1h|last6h|last24h|last\s+\d+\s*h|avg|max|min|trend|forecast|compare)/i;
const HISTORICAL_METRIC_AGGREGATION_PATTERNS =
  /(지난|최근|평균|최대|최소|합계|예측|비교|대비|변화|last1h|last6h|last24h|last\s+\d+\s*h|avg|max|min|forecast|compare)/i;
const CURRENT_RANKING_SIGNAL_PATTERNS =
  /(상위|하위|top|bottom)\s*\d{1,2}|가장\s*(높|낮|많|적)|\d{1,2}\s*(개|대|위|번째)|순위|랭킹|rank|highest|lowest|높은|낮은/i;
const METRIC_NAME_PATTERNS =
  /cpu|씨피유|메모리|mem|memory|디스크|disk|스토리지|storage|네트워크|network|부하|로드|load/i;
const LOCATION_GROUP_METRIC_PATTERNS =
  /(az\d*|dc\d+-?az\d+|가용\s*영역|availability\s*zone|구역|영역|zone|location|위치)/i;
const LOAD_BALANCE_PATTERNS =
  /(부하|로드|load|균형|balance|cpu|메모리|memory|mem|디스크|disk|스토리지|storage)/i;
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

type PrepareStepToolChoice =
  | 'auto'
  | 'required'
  | { type: 'tool'; toolName: string };

function resolvePrepareStepToolPolicy(intent: MonitoringToolIntent): {
  activeTools: ToolName[];
  toolChoice: PrepareStepToolChoice;
} {
  const policy = resolveMonitoringToolPolicy(intent);

  return {
    activeTools: policy.activeTools as ToolName[],
    toolChoice: policy.toolChoice,
  };
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
    (intent === 'data-ranking' ||
      (CURRENT_RANKING_SIGNAL_PATTERNS.test(q) &&
        METRIC_NAME_PATTERNS.test(q))) &&
    !HISTORICAL_METRIC_AGGREGATION_PATTERNS.test(q) &&
    !METRIC_TREND_RANKING_PATTERN.test(q) &&
    !getServerIdPattern().test(q)
  );
}

function shouldForceLocationMetricTool(query: string): boolean {
  const q = query.toLowerCase();

  return (
    LOCATION_GROUP_METRIC_PATTERNS.test(q) &&
    LOAD_BALANCE_PATTERNS.test(q) &&
    !getServerIdPattern().test(q)
  );
}

function shouldForceKnowledgeBaseTool(query: string): boolean {
  return FORCE_KB_QUERY_PATTERN.test(query.toLowerCase());
}

function isBestEffortGeneralQuery(
  query: string,
  intentFrame?: DomainIntentFrame
): boolean {
  const q = query.toLowerCase();
  if (INFRA_CONTEXT_PATTERN.test(q)) return false;
  if (FORCE_KB_QUERY_PATTERN.test(q)) return false;
  return (
    getIntentCategory(q, intentFrame) === 'general' ||
    BEST_EFFORT_GENERAL_PATTERNS.test(q)
  );
}

export function createPrepareStep(
  query: string,
  options?: {
    enableWebSearch?: boolean;
    enableRAG?: boolean;
    intentFrame?: DomainIntentFrame;
  }
) {
  const routingTrace = createRoutingDecisionTrace(
    extractQueryRoutingSignals(query)
  );
  void routingTrace;

  const q = query.toLowerCase();
  const webSearchEnabled = options?.enableWebSearch === true;
  const ragEnabled = options?.enableRAG === true;
  const intentCategory = getIntentCategory(q, options?.intentFrame);

  return async ({ stepNumber }: { stepNumber: number }) => {
    if (SIMPLE_CONVERSATION_PATTERNS.test(query.trim())) {
      logger.debug('[PrepareStep] Simple conversation detected, toolChoice: none');
      return { toolChoice: 'none' as const };
    }

    if (isFormattingOnlyReportRequest(q)) {
      return resolvePrepareStepToolPolicy('formattingOnly');
    }

    const shouldForceRealtimeMetric = shouldForceRealtimeServerMetricTool(q);
    const shouldForceMetricRanking = shouldForceMetricRankingTool(q);
    const shouldForceLocationMetric = shouldForceLocationMetricTool(q);
    const shouldForceKnowledgeBase = ragEnabled && shouldForceKnowledgeBaseTool(q);
    const shouldForceWeb = webSearchEnabled && shouldForceWebSearch(q);
    const isGeneralBestEffort = isBestEffortGeneralQuery(
      q,
      options?.intentFrame
    );

    if (shouldForceMetricRanking) {
      logger.debug(
        '[PrepareStep] Metric ranking query detected, forcing getServerMetricsAdvanced'
      );
      if (stepNumber > 0) {
        return resolvePrepareStepToolPolicy('general');
      }

      return resolvePrepareStepToolPolicy('metricRanking');
    }

    if (shouldForceLocationMetric) {
      logger.debug(
        '[PrepareStep] Location/AZ metric query detected, forcing getServerMetricsAdvanced'
      );
      if (stepNumber > 0) {
        return resolvePrepareStepToolPolicy('general');
      }

      return resolvePrepareStepToolPolicy('metricRanking');
    }

    if (
      shouldForceRealtimeMetric &&
      !shouldPreferAdvisorForOperationalAdvice(q)
    ) {
      logger.debug('[PrepareStep] Direct realtime server metric query detected, forcing getServerMetrics');
      if (stepNumber > 0) {
        return resolvePrepareStepToolPolicy('general');
      }

      return resolvePrepareStepToolPolicy('realtimeMetric');
    }

    if (isGeneralBestEffort) {
      if (shouldForceWeb && stepNumber === 0 && isTavilyAvailable()) {
        return resolvePrepareStepToolPolicy('webOnly');
      }

      return resolvePrepareStepToolPolicy('general');
    }

    // ── Step 1: 패턴 라우팅 — 쿼리 의도에 맞는 기본 도구 세트 결정 ──
    let activeTools: ToolName[];
    let toolChoice: 'auto' | 'required' | { type: 'tool'; toolName: string };

    let policyIntent: MonitoringToolIntent;

    if (intentCategory === 'anomaly') {
      policyIntent = 'anomaly';
    } else if (intentCategory === 'math') {
      policyIntent = 'math';
    } else if (intentCategory === 'prediction') {
      policyIntent = 'prediction';
    } else if (intentCategory === 'rca') {
      policyIntent = 'rca';
    } else if (intentCategory === 'advisor') {
      policyIntent = 'advisor';
    } else if (intentCategory === 'logs') {
      policyIntent = 'logs';
    } else if (intentCategory === 'serverGroup') {
      policyIntent = 'serverGroup';
    } else {
      policyIntent = 'metrics';
    }

    ({ activeTools, toolChoice } = resolvePrepareStepToolPolicy(policyIntent));

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

    if (
      policyIntent === 'advisor' &&
      shouldPreferAdvisorForOperationalAdvice(q) &&
      !shouldForceKnowledgeBase &&
      !shouldForceWeb
    ) {
      if (!activeTools.includes('getServerMetrics')) {
        const recommendCommandsIdx = activeTools.indexOf('recommendCommands');
        const finalAnswerIdx = activeTools.indexOf('finalAnswer');
        const insertionIdx =
          recommendCommandsIdx >= 0
            ? recommendCommandsIdx
            : finalAnswerIdx >= 0
              ? finalAnswerIdx
              : 0;
        activeTools.splice(insertionIdx, 0, 'getServerMetrics');
      }

      if (stepNumber === 0) {
        toolChoice = { type: 'tool', toolName: 'getServerMetrics' };
      } else if (stepNumber === 1 && activeTools.includes('recommendCommands')) {
        toolChoice = { type: 'tool', toolName: 'recommendCommands' };
      } else if (stepNumber > 1) {
        return resolvePrepareStepToolPolicy('general');
      }
    }

    return { activeTools, toolChoice };
  };
}
