import { isSingleModeAllowed } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import type {
  SupervisorLocalRouteDecision,
  SupervisorMode,
  SupervisorModeSelectionSource,
  SupervisorPlannerDriftReasonCode,
  SupervisorPlannerEscalationReasonCode,
  SupervisorPlannerExecutionMode,
  SupervisorPlannerShadow,
  SupervisorPlannerShadowCandidate,
  SupervisorPlannerShadowLocalDecision,
  SupervisorRequest,
  SupervisorRouteDecisionComplexity,
  SupervisorRouteDecisionExecutionPath,
  SupervisorRouteDecisionMode,
} from './supervisor-types';
import { selectExecutionMode } from './supervisor-routing';

export type ResolvedSupervisorMode = Exclude<SupervisorMode, 'auto'>;
export type SupervisorAssistantExecutionMode =
  | 'single-agent'
  | 'multi-agent';
export interface ResolvedSupervisorModeDecision {
  requestedMode: SupervisorMode;
  resolvedMode: ResolvedSupervisorMode;
  modeSelectionSource: SupervisorModeSelectionSource;
  autoSelectedByComplexity?: ResolvedSupervisorMode;
  analysisMode?: SupervisorRequest['analysisMode'];
}

const ROUTE_DECISION_RULE_VERSION = '2026-05-03-v1';
const SHADOW_PLANNER_VERSION = '2026-05-03-v1';
const EXECUTION_PATHS = new Set<SupervisorRouteDecisionExecutionPath>([
  'stream',
  'job',
  'client-artifact',
]);
const ROUTE_MODES = new Set<SupervisorRouteDecisionMode>([
  'single',
  'multi',
]);
const COMPLEXITIES = new Set<SupervisorRouteDecisionComplexity>([
  'simple',
  'moderate',
  'complex',
  'very_complex',
]);
const LOCAL_DECIDERS = new Set<SupervisorLocalRouteDecision['decidedBy']>([
  'frontend',
  'bff',
  'cloud-run',
]);
const LOCAL_INTENTS = new Set<SupervisorLocalRouteDecision['intent']>([
  'chat',
  'artifact',
  'job',
  'clarification',
]);
const ARTIFACT_KINDS = new Set<
  NonNullable<SupervisorLocalRouteDecision['artifactKind']>
>(['server-snapshot', 'incident-report', 'monitoring-analysis']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function fromSet<T extends string>(
  value: unknown,
  allowed: Set<T>
): T | undefined {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

function normalizeReasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(nonEmptyString)
    .filter((item): item is string => item !== undefined);
}

export function normalizeSupervisorLocalRouteDecision(
  value: unknown
): SupervisorLocalRouteDecision | undefined {
  if (!isRecord(value)) return undefined;

  const intent = fromSet(value.intent, LOCAL_INTENTS);
  const executionPath = fromSet(value.executionPath, EXECUTION_PATHS);
  const decidedBy = fromSet(value.decidedBy, LOCAL_DECIDERS);
  if (!intent || !executionPath || !decidedBy) return undefined;

  const mode = fromSet(value.mode, ROUTE_MODES);
  const artifactKind = fromSet(value.artifactKind, ARTIFACT_KINDS);
  const complexity = fromSet(value.complexity, COMPLEXITIES);
  const dataSlot = nonEmptyString(value.dataSlot);
  const traceId = nonEmptyString(value.traceId);

  return {
    intent,
    executionPath,
    ...(mode && { mode }),
    ...(artifactKind && { artifactKind }),
    ...(complexity && { complexity }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    ruleVersion:
      nonEmptyString(value.ruleVersion) ?? ROUTE_DECISION_RULE_VERSION,
    ...(dataSlot && { dataSlot }),
    ...(traceId && { traceId }),
    decidedBy,
  };
}

export interface SupervisorRouteDecision {
  intent: 'chat';
  executionPath: 'stream';
  mode: ResolvedSupervisorMode;
  reasonCodes: string[];
  ruleVersion: string;
  dataSlot?: string;
  traceId?: string;
  decidedBy: 'cloud-run';
}

export interface SupervisorAssistantPlan {
  kind: 'chat';
  planVersion: string;
  routeDecision: SupervisorRouteDecision;
  executionPath: 'stream';
  executionMode: SupervisorAssistantExecutionMode;
  stream: true;
  job: false;
  reasonCodes: string[];
  plannerShadow?: SupervisorPlannerShadow;
  dataSlot?: string;
  traceId?: string;
  decidedBy: 'cloud-run';
}

export interface SupervisorAssistantResult {
  kind: 'chat' | 'error';
  resultVersion: string;
  routeDecision?: SupervisorRouteDecision;
  status: 'completed' | 'failed' | 'partial';
  traceId?: string;
  errorCode?: string;
}

/**
 * Resolve final execution mode for the request.
 * 
 * 🎯 Strategy (2026-04-04):
 * 1. Multi-agent is the DEFAULT operational mode for OpenManager AI.
 * 2. Explicit single-agent requests are restricted and only allowed if ALLOW_DEGRADED_SINGLE=true.
 * 3. Auto mode follows query complexity so low-cost requests can stay single-agent on free tier.
 * 
 * @version 2.0.0
 */
export function resolveSupervisorModeDecision(
  request: Pick<SupervisorRequest, 'mode' | 'messages' | 'analysisMode'>,
): ResolvedSupervisorModeDecision {
  const requestedMode = request.mode || 'auto';
  const singleAllowed = isSingleModeAllowed();

  // 1. Explicit Multi-agent request (Golden Path)
  if (requestedMode === 'multi') {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'explicit',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  // 2. Explicit Single-agent request (Restricted)
  if (requestedMode === 'single') {
    if (!singleAllowed) {
      logger.warn('[SupervisorMode] Single-agent requested but NOT allowed in production. Upgrading to Multi-agent.');
      return {
        requestedMode,
        resolvedMode: 'multi',
        modeSelectionSource: 'single_disallowed_upgrade',
        ...(request.analysisMode
          ? { analysisMode: request.analysisMode }
          : {}),
      };
    }
    return {
      requestedMode,
      resolvedMode: 'single',
      modeSelectionSource: 'explicit',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  // 3. Auto-detection (follows query complexity)
  const lastUserMessage = request.messages.filter((message) => message.role === 'user').pop();
  if (!lastUserMessage) {
    return {
      requestedMode,
      resolvedMode: 'multi',
      modeSelectionSource: 'auto_default',
      ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
    };
  }

  const baselineMode =
    selectExecutionMode(lastUserMessage.content) === 'multi'
      ? 'multi'
      : 'single';
  const resolvedMode =
    selectExecutionMode(lastUserMessage.content, request.analysisMode) ===
    'multi'
      ? 'multi'
      : 'single';
  const modeSelectionSource =
    request.analysisMode === 'thinking' &&
    resolvedMode === 'multi' &&
    baselineMode !== 'multi'
      ? 'analysis_mode_thinking'
      : 'auto_complexity';

  return {
    requestedMode,
    resolvedMode,
    modeSelectionSource,
    autoSelectedByComplexity: resolvedMode,
    ...(request.analysisMode ? { analysisMode: request.analysisMode } : {}),
  };
}

export function resolveSupervisorMode(
  request: Pick<SupervisorRequest, 'mode' | 'messages' | 'analysisMode'>,
): ResolvedSupervisorMode {
  return resolveSupervisorModeDecision(request).resolvedMode;
}

export function buildSupervisorModeMetadata(
  decision: ResolvedSupervisorModeDecision,
  analysisMode?: SupervisorRequest['analysisMode'],
): {
  requestedMode: SupervisorMode;
  resolvedMode: ResolvedSupervisorMode;
  modeSelectionSource: SupervisorModeSelectionSource;
  autoSelectedByComplexity?: ResolvedSupervisorMode;
  analysisMode?: SupervisorRequest['analysisMode'];
} {
  return {
    requestedMode: decision.requestedMode,
    resolvedMode: decision.resolvedMode,
    modeSelectionSource: decision.modeSelectionSource,
    ...(decision.autoSelectedByComplexity
      ? { autoSelectedByComplexity: decision.autoSelectedByComplexity }
      : {}),
    ...((analysisMode ?? decision.analysisMode)
      ? { analysisMode: analysisMode ?? decision.analysisMode }
      : {}),
  };
}

export function buildSupervisorRouteDecision(
  decision: ResolvedSupervisorModeDecision,
  options?: {
    traceId?: string;
    queryAsOf?: SupervisorRequest['queryAsOf'];
  },
): SupervisorRouteDecision {
  return {
    intent: 'chat',
    executionPath: 'stream',
    mode: decision.resolvedMode,
    reasonCodes: [decision.modeSelectionSource],
    ruleVersion: ROUTE_DECISION_RULE_VERSION,
    ...(options?.queryAsOf?.dataSlot?.timeLabel && {
      dataSlot: options.queryAsOf.dataSlot.timeLabel,
    }),
    ...(options?.traceId && { traceId: options.traceId }),
    decidedBy: 'cloud-run',
  };
}

function getLastUserMessageContent(
  request: Pick<SupervisorRequest, 'messages'>
): string {
  return (
    request.messages
      .filter((message) => message.role === 'user')
      .pop()
      ?.content.trim() ?? ''
  );
}

function hasAnyAttachment(
  request: Pick<SupervisorRequest, 'images' | 'files'>
): boolean {
  return Boolean(request.images?.length || request.files?.length);
}

function includesPattern(query: string, pattern: RegExp): boolean {
  return pattern.test(query);
}

function hasIncidentReportIntent(query: string): boolean {
  return includesPattern(
    query,
    /(보고서|리포트|report|incident|postmortem|장애\s*분석|사고\s*분석)/iu
  );
}

function hasRcaIntent(query: string): boolean {
  return includesPattern(
    query,
    /(rca|root\s*cause|근본\s*원인|원인\s*분석|장애\s*원인|상관관계)/iu
  );
}

function hasAdvisorIntent(query: string): boolean {
  return includesPattern(
    query,
    /(조치|해결|권장|추천|최적화|remediation|advisor|runbook|how\s+to\s+fix|명령어)/iu
  );
}

function hasMetricLookupIntent(query: string): boolean {
  if (
    !includesPattern(
      query,
      /(cpu|memory|메모리|disk|디스크|network|네트워크|metric|metrics|사용률|상태|health)/iu
    )
  ) {
    return false;
  }

  return !includesPattern(
    query,
    /(요약|분석|보고서|리포트|원인|왜|추세|예측|비교|조치|해결)/iu
  );
}

function detectArtifactKind(
  query: string
): SupervisorPlannerShadowCandidate['artifactKind'] | undefined {
  if (
    includesPattern(
      query,
      /(server\s*snapshot|서버\s*상태\s*스냅샷|인프라\s*상태\s*카드|snapshot\s*export)/iu
    )
  ) {
    return 'server-snapshot';
  }

  if (
    includesPattern(
      query,
      /(incident\s*report\s*artifact|incident\s*card|장애\s*리포트\s*카드|사고\s*보고서\s*카드)/iu
    )
  ) {
    return 'incident-report';
  }

  if (
    includesPattern(
      query,
      /(monitoring\s*analysis\s*artifact|monitoring\s*card|모니터링\s*분석\s*카드)/iu
    )
  ) {
    return 'monitoring-analysis';
  }

  return undefined;
}

function buildShadowCandidate(
  request: Pick<
    SupervisorRequest,
    'analysisMode' | 'files' | 'images' | 'messages' | 'queryAsOf' | 'traceId'
  >
): SupervisorPlannerShadowCandidate {
  const query = getLastUserMessageContent(request);

  const buildCandidate = (
    executionPath: SupervisorRouteDecisionExecutionPath,
    executionMode: SupervisorPlannerExecutionMode,
    reasonCodes: string[],
    escalationReasonCodes?: SupervisorPlannerEscalationReasonCode[],
    artifactKind?: SupervisorPlannerShadowCandidate['artifactKind']
  ): SupervisorPlannerShadowCandidate => ({
    kind: artifactKind ? 'artifact' : 'chat',
    executionPath,
    executionMode,
    ...(artifactKind && { artifactKind }),
    reasonCodes,
    ...(escalationReasonCodes && escalationReasonCodes.length > 0
      ? { escalationReasonCodes }
      : {}),
    decidedBy: 'cloud-run',
  });

  if (hasAnyAttachment(request)) {
    return buildCandidate('stream', 'multi-agent', ['vision_input'], [
      'vision_input_present',
    ]);
  }

  const artifactKind = detectArtifactKind(query);
  if (artifactKind) {
    return buildCandidate(
      'client-artifact',
      'deterministic',
      [`artifact_${artifactKind}`],
      undefined,
      artifactKind
    );
  }

  if (hasIncidentReportIntent(query)) {
    return buildCandidate('job', 'multi-agent', ['incident_report'], [
      'incident_report_requested',
    ]);
  }

  if (hasRcaIntent(query)) {
    return buildCandidate('stream', 'multi-agent', ['rca_analysis'], [
      'rca_requested',
    ]);
  }

  if (hasAdvisorIntent(query)) {
    return buildCandidate('stream', 'multi-agent', ['advisor_request'], [
      'advisor_requested',
    ]);
  }

  if (
    request.analysisMode === 'thinking' &&
    query.length > 0 &&
    selectExecutionMode(query, 'thinking') === 'multi' &&
    selectExecutionMode(query) !== 'multi'
  ) {
    return buildCandidate('stream', 'multi-agent', ['analysis_mode_thinking'], [
      'analysis_mode_thinking',
    ]);
  }

  if (hasMetricLookupIntent(query)) {
    return buildCandidate('stream', 'deterministic', ['metric_lookup']);
  }

  return buildCandidate('stream', 'single-agent', ['single_agent_default']);
}

function inferLocalExecutionMode(
  localDecision: SupervisorLocalRouteDecision
): SupervisorPlannerExecutionMode | undefined {
  if (localDecision.executionPath === 'client-artifact') {
    return 'deterministic';
  }
  if (localDecision.mode === 'multi') {
    return 'multi-agent';
  }
  if (localDecision.mode === 'single') {
    return 'single-agent';
  }
  if (localDecision.executionPath === 'job') {
    return 'multi-agent';
  }
  if (
    localDecision.complexity === 'simple' &&
    localDecision.reasonCodes.includes('complexity_below_threshold')
  ) {
    return 'deterministic';
  }
  if (localDecision.executionPath === 'stream') {
    return 'single-agent';
  }
  return undefined;
}

function buildShadowLocalDecision(
  localDecision: SupervisorLocalRouteDecision
): SupervisorPlannerShadowLocalDecision {
  return {
    intent: localDecision.intent,
    executionPath: localDecision.executionPath,
    ...(localDecision.mode && { mode: localDecision.mode }),
    ...(localDecision.complexity && { complexity: localDecision.complexity }),
    reasonCodes: [...localDecision.reasonCodes],
    decidedBy: localDecision.decidedBy,
  };
}

function buildPlannerDrift(
  candidate: SupervisorPlannerShadowCandidate,
  localDecision?: SupervisorLocalRouteDecision
): SupervisorPlannerShadow['drift'] {
  if (!localDecision) {
    return {
      matched: false,
      reasonCodes: ['local_decision_missing'],
    };
  }

  const reasonCodes: SupervisorPlannerDriftReasonCode[] = [];
  if (candidate.executionPath !== localDecision.executionPath) {
    reasonCodes.push('execution_path_mismatch');
  }

  const localExecutionMode = inferLocalExecutionMode(localDecision);
  if (localExecutionMode && candidate.executionMode !== localExecutionMode) {
    reasonCodes.push('execution_mode_mismatch');
  }

  if (
    candidate.artifactKind &&
    localDecision.artifactKind &&
    candidate.artifactKind !== localDecision.artifactKind
  ) {
    reasonCodes.push('artifact_kind_mismatch');
  }

  return {
    matched: reasonCodes.length === 0,
    reasonCodes,
  };
}

export function buildSupervisorPlannerShadow({
  request,
  routeDecision: _routeDecision,
  localRouteDecision,
  latencyMs,
}: {
  request: Pick<
    SupervisorRequest,
    'analysisMode' | 'files' | 'images' | 'messages' | 'queryAsOf' | 'traceId'
  >;
  routeDecision: SupervisorRouteDecision;
  localRouteDecision?: SupervisorLocalRouteDecision;
  latencyMs?: number;
}): SupervisorPlannerShadow {
  const candidate = buildShadowCandidate(request);
  const drift = buildPlannerDrift(candidate, localRouteDecision);

  return {
    plannerVersion: SHADOW_PLANNER_VERSION,
    candidate,
    ...(localRouteDecision && {
      localDecision: buildShadowLocalDecision(localRouteDecision),
    }),
    drift,
    ...(typeof latencyMs === 'number' &&
    Number.isFinite(latencyMs) &&
    latencyMs >= 0
      ? { latencyMs: Math.round(latencyMs) }
      : {}),
  };
}

function buildSupervisorPlannerShadowForRequest(
  request: SupervisorRequest,
  routeDecision: SupervisorRouteDecision
): SupervisorPlannerShadow {
  const plannerStart = Date.now();
  return buildSupervisorPlannerShadow({
    request,
    routeDecision,
    localRouteDecision: request.localRouteDecision,
    latencyMs: Date.now() - plannerStart,
  });
}

export function buildSupervisorAssistantPlan(
  routeDecision: SupervisorRouteDecision,
  options?: {
    plannerShadow?: SupervisorPlannerShadow;
  }
): SupervisorAssistantPlan {
  return {
    kind: 'chat',
    planVersion: ROUTE_DECISION_RULE_VERSION,
    routeDecision,
    executionPath: 'stream',
    executionMode:
      routeDecision.mode === 'multi' ? 'multi-agent' : 'single-agent',
    stream: true,
    job: false,
    reasonCodes: [...routeDecision.reasonCodes],
    ...(options?.plannerShadow && {
      plannerShadow: options.plannerShadow,
    }),
    ...(routeDecision.dataSlot && { dataSlot: routeDecision.dataSlot }),
    ...(routeDecision.traceId && { traceId: routeDecision.traceId }),
    decidedBy: 'cloud-run',
  };
}

export function buildSupervisorAssistantPlanForRequest(
  request: SupervisorRequest,
  routeDecision: SupervisorRouteDecision
): SupervisorAssistantPlan {
  return buildSupervisorAssistantPlan(routeDecision, {
    plannerShadow: buildSupervisorPlannerShadowForRequest(
      request,
      routeDecision
    ),
  });
}

export function buildSupervisorAssistantResult(
  routeDecision: SupervisorRouteDecision | undefined,
  options?: {
    status?: SupervisorAssistantResult['status'];
    errorCode?: string;
  }
): SupervisorAssistantResult {
  const status = options?.status ?? 'completed';
  return {
    kind: status === 'failed' ? 'error' : 'chat',
    resultVersion: ROUTE_DECISION_RULE_VERSION,
    ...(routeDecision && { routeDecision }),
    status,
    ...(routeDecision?.traceId && { traceId: routeDecision.traceId }),
    ...(options?.errorCode && { errorCode: options.errorCode }),
  };
}
