import {
  getToolLabel,
  hasToolPresentation,
} from '@/lib/ai/utils/tool-presentation';
import type {
  AnalysisBasis,
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import { ANALYSIS_MODE_LABELS } from '@/types/ai/analysis-mode';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';

export type LatencyTier = 'fast' | 'normal' | 'slow' | 'very_slow';
export type ResolvedMode = 'single' | 'multi';
export type AnalysisBasisTab = 'process' | 'detail';

export interface AnalysisBasisBadgeProps {
  basis: AnalysisBasis;
  details?: string | null;
  debugDetails?: string | null;
  thinkingSteps?: AIThinkingStep[];
  traceId?: string;
  processingTime?: number;
  latencyTier?: LatencyTier;
  resolvedMode?: ResolvedMode;
  modeSelectionSource?: string;
  handoffHistory?: ResponseHandoff[];
  toolResultSummaries?: ToolResultSummary[];
  className?: string;
}

export interface ProcessRouteInfo {
  kind:
    | 'direct-response'
    | 'direct-tool'
    | 'handoff'
    | 'fallback-recovery'
    | 'thinking-only';
  label: string;
  description: string;
  badgeClassName: string;
}

export interface FailureReasonInfo {
  code:
    | 'server-not-found'
    | 'tool-timeout'
    | 'schema-validation'
    | 'empty-data-window'
    | 'fallback-triggered'
    | 'tool-failed';
  label: string;
}

export interface FailureReasonEntry {
  toolName: string;
  reason: FailureReasonInfo;
}

const AGENT_ROLE_LABELS: Record<string, string> = {
  Orchestrator: '분석 조율',
  supervisor: '분석 조율',
  'NLQ Agent': '자연어 분석',
  nlq: '자연어 분석',
  'Analyst Agent': '심층 분석',
  analyst: '심층 분석',
  'Reporter Agent': '보고서 생성',
  reporter: '보고서 생성',
  'Advisor Agent': '운영 어드바이저',
  advisor: '운영 어드바이저',
  'Vision Agent': '시각 분석',
  vision: '시각 분석',
};

const SERVER_REFERENCE_PATTERN = /\b[a-z]+(?:-[a-z0-9]+){2,}(?::\d+)?\b/gi;

export const STEP_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
};

export const LATENCY_TIER_LABELS: Record<LatencyTier, string> = {
  fast: '빠름',
  normal: '보통',
  slow: '느림',
  very_slow: '매우 느림',
};

export const RESOLVED_MODE_LABELS: Record<ResolvedMode, string> = {
  single: '단일 응답',
  multi: '오케스트레이션 협업',
};

const RESOLVED_MODE_DESCRIPTION_LABELS: Record<ResolvedMode, string> = {
  single: '한 응답 경로에서 바로 답변을 구성했습니다.',
  multi:
    '조율기가 specialist와 도구 경로를 묶어 답변을 구성했습니다. deep multi-hop만 뜻하지 않습니다.',
};

const MODE_SELECTION_SOURCE_LABELS: Record<string, string> = {
  explicit: '사용자 지정',
  auto_complexity: '복잡도 자동 판단',
  analysis_mode_thinking: '심층 분석 모드',
  auto_default: '기본 자동 규칙',
  single_disallowed_upgrade: '단일 금지 업그레이드',
};

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getAgentRoleLabel(name: string): string {
  return AGENT_ROLE_LABELS[name] ?? name;
}

export function buildExecutionPath(
  handoffHistory?: ResponseHandoff[]
): string[] {
  if (!handoffHistory || handoffHistory.length === 0) {
    return [];
  }

  const path: string[] = [getAgentRoleLabel(handoffHistory[0]?.from ?? '')];
  for (const handoff of handoffHistory) {
    const nextLabel = getAgentRoleLabel(handoff.to);
    if (path[path.length - 1] !== nextLabel) {
      path.push(nextLabel);
    }
  }

  return path.filter(Boolean);
}

export function buildTechnicalExecutionPath(
  handoffHistory?: ResponseHandoff[]
): string[] {
  if (!handoffHistory || handoffHistory.length === 0) {
    return [];
  }

  const path: string[] = [handoffHistory[0]?.from ?? ''];
  for (const handoff of handoffHistory) {
    if (path[path.length - 1] !== handoff.to) {
      path.push(handoff.to);
    }
  }

  return path.filter(Boolean);
}

function normalizeServerReference(reference: string): string {
  return reference.replace(/:\d+$/, '');
}

export function extractReferencedServers(
  parts: Array<string | null | undefined>
): string[] {
  const servers = new Set<string>();

  for (const part of parts) {
    if (!part) continue;

    const matches = part.match(SERVER_REFERENCE_PATTERN) ?? [];
    for (const match of matches) {
      servers.add(normalizeServerReference(match));
    }
  }

  return [...servers];
}

export function classifyFailureReason(
  summary: string,
  preview?: string
): FailureReasonInfo {
  const text = `${summary}\n${preview ?? ''}`.toLowerCase();

  if (
    text.includes('찾을 수 없습니다') ||
    text.includes('not found') ||
    text.includes('unknown server')
  ) {
    return {
      code: 'server-not-found',
      label: '대상 서버 확인 실패',
    };
  }

  if (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('시간 초과')
  ) {
    return {
      code: 'tool-timeout',
      label: '도구 시간 초과',
    };
  }

  if (
    text.includes('schema') ||
    text.includes('validation') ||
    text.includes('유효성') ||
    text.includes('형식 오류')
  ) {
    return {
      code: 'schema-validation',
      label: '도구 응답 형식 오류',
    };
  }

  if (
    text.includes('데이터가 없') ||
    text.includes('no data') ||
    text.includes('empty result') ||
    text.includes('빈 결과')
  ) {
    return {
      code: 'empty-data-window',
      label: '데이터 창 비어 있음',
    };
  }

  if (
    text.includes('fallback') ||
    text.includes('전체 서버 스캔') ||
    text.includes('대체 경로')
  ) {
    return {
      code: 'fallback-triggered',
      label: 'fallback 경로 전환',
    };
  }

  return {
    code: 'tool-failed',
    label: '도구 실행 실패',
  };
}

export function inferProcessRoute(params: {
  engine: string;
  handoffHistory?: ResponseHandoff[];
  toolResultSummaries?: ToolResultSummary[];
  thinkingSteps?: AIThinkingStep[];
  meaningfulTools?: string[];
}): ProcessRouteInfo {
  const {
    engine,
    handoffHistory,
    toolResultSummaries,
    thinkingSteps,
    meaningfulTools,
  } = params;

  const hasHandoff = Boolean(handoffHistory && handoffHistory.length > 0);
  const summaries = toolResultSummaries ?? [];
  const failedCount = summaries.filter(
    (summary) => summary.status === 'failed'
  ).length;
  const completedCount = summaries.filter(
    (summary) => summary.status === 'completed'
  ).length;
  const toolNames = meaningfulTools ?? [];
  const hasAllServerFallbackPair =
    toolNames.some((tool) => tool.endsWith('AllServers')) &&
    toolNames.some(
      (tool) =>
        !tool.endsWith('AllServers') && hasToolPresentation(`${tool}AllServers`)
    );
  const hasFallbackKeyword =
    engine.toLowerCase().includes('fallback') ||
    summaries.some((summary) =>
      `${summary.summary}\n${summary.preview ?? ''}`
        .toLowerCase()
        .includes('fallback')
    ) ||
    summaries.some((summary) =>
      `${summary.summary}\n${summary.preview ?? ''}`.includes('전체 서버 스캔')
    );

  if (
    hasFallbackKeyword ||
    (failedCount > 0 && completedCount > 0) ||
    hasAllServerFallbackPair
  ) {
    return {
      kind: 'fallback-recovery',
      label: 'fallback 보정 경로',
      description:
        '직접 경로가 막히거나 부족해 전체 스캔 또는 대체 경로로 보정한 뒤 응답을 구성했습니다.',
      badgeClassName: 'border border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (hasHandoff) {
    return {
      kind: 'handoff',
      label: 'handoff 협업 경로',
      description:
        '복수 에이전트 handoff를 거쳐 역할을 나눠 응답을 구성했습니다.',
      badgeClassName: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
    };
  }

  if (summaries.length > 0 || toolNames.length > 0) {
    return {
      kind: 'direct-tool',
      label: '직접 도구 경로',
      description: '대상 도구를 직접 실행해 응답을 구성했습니다.',
      badgeClassName:
        'border border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  if (thinkingSteps && thinkingSteps.length > 0) {
    return {
      kind: 'thinking-only',
      label: '단일 추론 경로',
      description: '추론 단계만으로 응답을 구성했습니다.',
      badgeClassName: 'border border-sky-200 bg-sky-50 text-sky-700',
    };
  }

  return {
    kind: 'direct-response',
    label: '직접 응답 경로',
    description: '추가 handoff나 fallback 없이 응답을 구성했습니다.',
    badgeClassName: 'border border-slate-200 bg-slate-50 text-slate-700',
  };
}

export function buildFailureReasons(
  toolResultSummaries?: ToolResultSummary[]
): FailureReasonEntry[] {
  return (toolResultSummaries ?? [])
    .filter((toolResult) => toolResult.status === 'failed')
    .map((toolResult) => ({
      toolName: toolResult.toolName,
      reason: classifyFailureReason(toolResult.summary, toolResult.preview),
    }));
}

export function buildReferencedServers(params: {
  basis: AnalysisBasis;
  debugDetails?: string | null;
  details?: string | null;
  handoffHistory?: ResponseHandoff[];
  thinkingSteps?: AIThinkingStep[];
  toolResultSummaries?: ToolResultSummary[];
}): string[] {
  const {
    basis,
    debugDetails,
    details,
    handoffHistory,
    thinkingSteps,
    toolResultSummaries,
  } = params;

  return extractReferencedServers([
    basis.dataSource,
    details,
    debugDetails,
    ...(toolResultSummaries ?? []).flatMap((toolResult) => [
      toolResult.summary,
      toolResult.preview,
    ]),
    ...(thinkingSteps ?? []).flatMap((step) => [
      step.title,
      step.description,
      step.content,
    ]),
    ...(handoffHistory ?? []).map((handoff) => handoff.reason),
  ]);
}

export function buildDebugBundle(params: {
  basis: AnalysisBasis;
  executionPath: string[];
  failureReasons: FailureReasonEntry[];
  meaningfulTools?: string[];
  processRoute: ProcessRouteInfo;
  referencedServers: string[];
  toolResultSummaries?: ToolResultSummary[];
  traceId?: string;
}): string {
  const {
    basis,
    executionPath,
    failureReasons,
    meaningfulTools,
    processRoute,
    referencedServers,
    toolResultSummaries,
    traceId,
  } = params;

  const toolCalls = (toolResultSummaries ?? meaningfulTools ?? []).map(
    (tool) =>
      typeof tool === 'string'
        ? {
            toolName: tool,
            label: getToolLabel(tool),
            status: 'observed',
          }
        : {
            toolName: tool.toolName,
            label: getToolLabel(tool.toolName),
            status: tool.status,
            summary: tool.summary,
          }
  );

  return JSON.stringify(
    {
      route: {
        kind: processRoute.kind,
        label: processRoute.label,
      },
      traceId: traceId ?? null,
      analysisMode: basis.analysisMode ?? null,
      engine: basis.engine,
      dataSource: basis.dataSource,
      timeRange: basis.timeRange ?? null,
      serverCount: basis.serverCount ?? null,
      referencedServers,
      executionPath,
      toolCalls,
      failureReasons: failureReasons.map((failure) => ({
        toolName: failure.toolName,
        code: failure.reason.code,
        label: failure.reason.label,
      })),
    },
    null,
    2
  );
}

export function buildRuntimeSummaryItems(params: {
  latencyTier?: LatencyTier;
  processingTime?: number;
  resolvedMode?: ResolvedMode;
}): string[] {
  const { latencyTier, processingTime, resolvedMode } = params;

  return [
    typeof processingTime === 'number' ? `${processingTime}ms` : null,
    resolvedMode ? `${RESOLVED_MODE_LABELS[resolvedMode]} 경로` : null,
    latencyTier ? `지연 ${LATENCY_TIER_LABELS[latencyTier]}` : null,
  ].filter(Boolean) as string[];
}

export function getModeSelectionLabel(
  modeSelectionSource?: string
): string | null {
  if (!modeSelectionSource) {
    return null;
  }

  return (
    MODE_SELECTION_SOURCE_LABELS[modeSelectionSource] ?? modeSelectionSource
  );
}

export function getResolvedModeDescription(
  resolvedMode?: ResolvedMode
): string | null {
  if (!resolvedMode) {
    return null;
  }

  return RESOLVED_MODE_DESCRIPTION_LABELS[resolvedMode];
}

function buildAnalysisStepSummary(params: {
  basis: AnalysisBasis;
  executionPath: string[];
  meaningfulTools?: string[];
}): string | null {
  const { basis, executionPath, meaningfulTools } = params;

  if (executionPath.length > 0) {
    return `경로: ${executionPath.join(' → ')}`;
  }

  if (meaningfulTools && meaningfulTools.length > 0) {
    const preview = meaningfulTools.slice(0, 2).map(getToolLabel).join(' · ');
    const suffix =
      meaningfulTools.length > 2 ? ` 외 ${meaningfulTools.length - 2}` : '';
    return `도구: ${preview}${suffix}`;
  }

  if (basis.dataSource) {
    return `데이터: ${basis.dataSource}`;
  }

  return null;
}

export function buildCollapsedSummary(params: {
  basis: AnalysisBasis;
  executionPath: string[];
  handoffCount: number;
  meaningfulTools?: string[];
  toolCount: number;
}): { collapsedSummary: string; collapsedTitle: string } {
  const { basis, executionPath, handoffCount, meaningfulTools, toolCount } =
    params;
  const analysisStepSummary = buildAnalysisStepSummary({
    basis,
    executionPath,
    meaningfulTools,
  });
  const parts = [
    analysisStepSummary,
    executionPath.length > 0 && toolCount > 0 ? `도구 ${toolCount}개` : null,
    basis.analysisMode
      ? `모드: ${ANALYSIS_MODE_LABELS[basis.analysisMode]}`
      : null,
    basis.timeRange ? `기간: ${basis.timeRange}` : null,
    handoffCount > 0 ? `handoff ${handoffCount}회` : null,
  ].filter(Boolean) as string[];

  return {
    collapsedSummary: parts.slice(0, 3).join(' · '),
    collapsedTitle: parts.join(' · '),
  };
}

export function hasTechnicalAnalysisDetails(params: {
  debugDetails?: string | null;
  handoffHistory?: ResponseHandoff[];
  modeSelectionLabel?: string | null;
  runtimeSummaryItems: string[];
  technicalExecutionPath: string[];
  thinkingSteps?: AIThinkingStep[];
  toolResultSummaries?: ToolResultSummary[];
  traceId?: string;
}): boolean {
  const {
    debugDetails,
    handoffHistory,
    modeSelectionLabel,
    runtimeSummaryItems,
    technicalExecutionPath,
    thinkingSteps,
    toolResultSummaries,
    traceId,
  } = params;

  return (
    Boolean(traceId) ||
    Boolean(thinkingSteps && thinkingSteps.length > 0) ||
    Boolean(handoffHistory && handoffHistory.length > 0) ||
    Boolean(toolResultSummaries && toolResultSummaries.length > 0) ||
    technicalExecutionPath.length > 0 ||
    runtimeSummaryItems.length > 0 ||
    Boolean(modeSelectionLabel) ||
    Boolean(debugDetails)
  );
}

export function getEngineColor(engine: string): string {
  if (engine.includes('Cloud Run')) return 'text-green-600';
  if (engine.includes('Fallback')) return 'text-orange-500';
  if (engine.includes('Streaming')) return 'text-blue-500';
  return 'text-gray-600';
}
