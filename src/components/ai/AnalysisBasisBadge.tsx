'use client';

import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Cpu,
  Database,
  ExternalLink,
} from 'lucide-react';
import {
  type FC,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getThinkingStepPresentation,
  getToolDescription,
  getToolLabel,
  getToolPresentation,
  hasToolPresentation,
} from '@/lib/ai/utils/tool-presentation';
import type {
  AnalysisBasis,
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import { ANALYSIS_MODE_LABELS } from '@/types/ai/analysis-mode';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { RenderMarkdownContent } from '@/utils/markdown-parser';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// 내부 에이전트 기술명 → 사용자 친화적 역할명 (구현 세부사항 비공개)
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

function getAgentRoleLabel(name: string): string {
  return AGENT_ROLE_LABELS[name] ?? name;
}

function buildExecutionPath(handoffHistory?: ResponseHandoff[]): string[] {
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

function buildTechnicalExecutionPath(
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

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
};

const LATENCY_TIER_LABELS: Record<
  'fast' | 'normal' | 'slow' | 'very_slow',
  string
> = {
  fast: '빠름',
  normal: '보통',
  slow: '느림',
  very_slow: '매우 느림',
};

const RESOLVED_MODE_LABELS: Record<'single' | 'multi', string> = {
  single: '단일 응답',
  multi: '오케스트레이션 협업',
};

const RESOLVED_MODE_DESCRIPTION_LABELS: Record<'single' | 'multi', string> = {
  single: '한 응답 경로에서 바로 답변을 구성했습니다.',
  multi:
    '조율기가 specialist와 도구 경로를 묶어 답변을 구성했습니다. deep multi-hop만 뜻하지 않습니다.',
};

const MODE_SELECTION_SOURCE_LABELS: Record<string, string> = {
  explicit: '사용자 지정',
  auto_complexity: '복잡도 자동 판단',
  analysis_mode_thinking: 'Thinking 모드',
  auto_default: '기본 자동 규칙',
  single_disallowed_upgrade: '단일 금지 업그레이드',
};

interface ProcessRouteInfo {
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

interface FailureReasonInfo {
  code:
    | 'server-not-found'
    | 'tool-timeout'
    | 'schema-validation'
    | 'empty-data-window'
    | 'fallback-triggered'
    | 'tool-failed';
  label: string;
}

const SERVER_REFERENCE_PATTERN = /\b[a-z]+(?:-[a-z0-9]+){2,}(?::\d+)?\b/gi;

function normalizeServerReference(reference: string): string {
  return reference.replace(/:\d+$/, '');
}

function extractReferencedServers(
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

function classifyFailureReason(
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

function inferProcessRoute(params: {
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

const CopyActionButton: FC<{
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
}> = ({ text, label, copiedLabel = '복사됨', className = '' }) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) return;

    void clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = setTimeout(() => {
          setCopied(false);
          resetTimerRef.current = null;
        }, 1500);
      })
      .catch(() => {
        // Clipboard access can fail on insecure/non-focused contexts.
      });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-2xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 ${className}`}
      aria-label={label}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
};

interface AnalysisBasisBadgeProps {
  basis: AnalysisBasis;
  details?: string | null;
  debugDetails?: string | null;
  thinkingSteps?: AIThinkingStep[];
  traceId?: string;
  processingTime?: number;
  latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
  resolvedMode?: 'single' | 'multi';
  modeSelectionSource?: string;
  handoffHistory?: ResponseHandoff[];
  toolResultSummaries?: ToolResultSummary[];
  className?: string;
}

type AnalysisBasisTab = 'process' | 'detail';

/**
 * 분석 근거 뱃지 컴포넌트
 *
 * AI 응답의 투명성을 위해 분석에 사용된 근거 정보를 표시합니다.
 * - 데이터 소스
 * - AI 엔진
 * - 호출된 도구 목록
 * - RAG 참조 문서
 */
export const AnalysisBasisBadge: FC<AnalysisBasisBadgeProps> = ({
  basis,
  details,
  debugDetails,
  thinkingSteps,
  traceId,
  processingTime,
  latencyTier,
  resolvedMode,
  modeSelectionSource,
  handoffHistory,
  toolResultSummaries,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisBasisTab>('process');
  const tabIdBase = useId();
  const processTabId = `${tabIdBase}-process-tab`;
  const detailTabId = `${tabIdBase}-detail-tab`;
  const processPanelId = `${tabIdBase}-process-panel`;
  const detailPanelId = `${tabIdBase}-detail-panel`;
  const processTabRef = useRef<HTMLButtonElement | null>(null);
  const detailTabRef = useRef<HTMLButtonElement | null>(null);

  const getEngineColor = (engine: string) => {
    if (engine.includes('Cloud Run')) return 'text-green-600';
    if (engine.includes('Fallback')) return 'text-orange-500';
    if (engine.includes('Streaming')) return 'text-blue-500';
    return 'text-gray-600';
  };

  // finalAnswer 제외한 실질적 도구 호출
  const meaningfulTools = basis.toolsCalled?.filter((t) => t !== 'finalAnswer');
  const executionPath = buildExecutionPath(handoffHistory);
  const technicalExecutionPath = useMemo(
    () => buildTechnicalExecutionPath(handoffHistory),
    [handoffHistory]
  );
  const toolCount = toolResultSummaries?.length ?? meaningfulTools?.length ?? 0;
  const failureReasons = useMemo(
    () =>
      (toolResultSummaries ?? [])
        .filter((toolResult) => toolResult.status === 'failed')
        .map((toolResult) => ({
          toolName: toolResult.toolName,
          reason: classifyFailureReason(toolResult.summary, toolResult.preview),
        })),
    [toolResultSummaries]
  );
  const processRoute = useMemo(
    () =>
      inferProcessRoute({
        engine: basis.engine,
        handoffHistory,
        toolResultSummaries,
        thinkingSteps,
        meaningfulTools,
      }),
    [
      basis.engine,
      handoffHistory,
      meaningfulTools,
      thinkingSteps,
      toolResultSummaries,
    ]
  );
  const referencedServers = useMemo(
    () =>
      extractReferencedServers([
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
      ]),
    [
      basis.dataSource,
      details,
      debugDetails,
      handoffHistory,
      thinkingSteps,
      toolResultSummaries,
    ]
  );
  const debugBundle = useMemo(
    () =>
      JSON.stringify(
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
          toolCalls:
            (toolResultSummaries ?? meaningfulTools ?? []).map((tool) =>
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
            ) ?? [],
          failureReasons: failureReasons.map((failure) => ({
            toolName: failure.toolName,
            code: failure.reason.code,
            label: failure.reason.label,
          })),
        },
        null,
        2
      ),
    [
      basis.analysisMode,
      basis.dataSource,
      basis.engine,
      basis.serverCount,
      basis.timeRange,
      executionPath,
      failureReasons,
      meaningfulTools,
      processRoute.kind,
      processRoute.label,
      referencedServers,
      toolResultSummaries,
      traceId,
    ]
  );
  const analysisStepSummary =
    executionPath.length > 0
      ? `경로: ${executionPath.join(' → ')}`
      : meaningfulTools && meaningfulTools.length > 0
        ? `도구: ${meaningfulTools
            .slice(0, 2)
            .map(getToolLabel)
            .join(
              ' · '
            )}${meaningfulTools.length > 2 ? ` 외 ${meaningfulTools.length - 2}` : ''}`
        : basis.dataSource
          ? `데이터: ${basis.dataSource}`
          : null;
  const collapsedSummaryParts = [
    analysisStepSummary,
    executionPath.length > 0 && toolCount > 0 ? `도구 ${toolCount}개` : null,
    basis.analysisMode
      ? `모드: ${ANALYSIS_MODE_LABELS[basis.analysisMode]}`
      : null,
    basis.timeRange ? `기간: ${basis.timeRange}` : null,
    handoffHistory && handoffHistory.length > 0
      ? `handoff ${handoffHistory.length}회`
      : null,
  ].filter(Boolean);
  const collapsedSummary = collapsedSummaryParts.slice(0, 3).join(' · ');
  const collapsedTitle = collapsedSummaryParts.join(' · ');
  const runtimeSummaryItems = [
    typeof processingTime === 'number' ? `${processingTime}ms` : null,
    resolvedMode ? `${RESOLVED_MODE_LABELS[resolvedMode]} 경로` : null,
    latencyTier ? `지연 ${LATENCY_TIER_LABELS[latencyTier]}` : null,
  ].filter(Boolean);
  const modeSelectionLabel = modeSelectionSource
    ? (MODE_SELECTION_SOURCE_LABELS[modeSelectionSource] ?? modeSelectionSource)
    : null;
  const resolvedModeDescription = resolvedMode
    ? RESOLVED_MODE_DESCRIPTION_LABELS[resolvedMode]
    : null;
  const hasTechnicalDetails =
    Boolean(traceId) ||
    Boolean(thinkingSteps && thinkingSteps.length > 0) ||
    Boolean(handoffHistory && handoffHistory.length > 0) ||
    Boolean(toolResultSummaries && toolResultSummaries.length > 0) ||
    technicalExecutionPath.length > 0 ||
    runtimeSummaryItems.length > 0 ||
    Boolean(modeSelectionLabel) ||
    Boolean(debugDetails);
  const tabButtonClassName = (tab: AnalysisBasisTab) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      activeTab === tab
        ? 'bg-slate-900 text-white'
        : 'bg-white text-slate-600 hover:bg-slate-100'
    }`;
  const activateTab = (tab: AnalysisBasisTab) => {
    setActiveTab(tab);
    if (tab === 'process') {
      processTabRef.current?.focus();
      return;
    }
    detailTabRef.current?.focus();
  };
  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: AnalysisBasisTab
  ) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        activateTab(tab === 'process' ? 'detail' : 'process');
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        activateTab(tab === 'process' ? 'detail' : 'process');
        break;
      case 'Home':
        event.preventDefault();
        activateTab('process');
        break;
      case 'End':
        event.preventDefault();
        activateTab('detail');
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={`mt-2 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-xs ${className}`}
    >
      {/* 헤더 (클릭으로 토글) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
        aria-expanded={isExpanded}
        aria-label="분석 근거 상세 보기"
      >
        <span className="flex items-center gap-2 text-gray-600">
          <Database className="h-4 w-4" />
          <span className="font-medium">분석 근거</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {!isExpanded && collapsedSummary && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          <p className="truncate" title={collapsedTitle}>
            {collapsedSummary}
          </p>
        </div>
      )}

      {/* 상세 정보 (확장 시) */}
      {isExpanded && (
        <div className="min-w-0 space-y-2 border-t border-gray-200 px-3 pb-3 pt-1">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  분석 보기
                </p>
                <p className="text-2xs text-slate-500">
                  일반 사용자용 과정 보기와 디버그 보기를 전환합니다.
                </p>
              </div>
              <div
                role="tablist"
                aria-label="과정 및 디버그 보기 전환"
                className="inline-flex rounded-full bg-slate-100 p-1"
              >
                <button
                  id={processTabId}
                  ref={processTabRef}
                  type="button"
                  role="tab"
                  aria-controls={processPanelId}
                  aria-selected={activeTab === 'process'}
                  tabIndex={activeTab === 'process' ? 0 : -1}
                  className={tabButtonClassName('process')}
                  onClick={() => setActiveTab('process')}
                  onKeyDown={(event) => handleTabKeyDown(event, 'process')}
                >
                  과정 보기
                </button>
                <button
                  id={detailTabId}
                  ref={detailTabRef}
                  type="button"
                  role="tab"
                  aria-controls={detailPanelId}
                  aria-selected={activeTab === 'detail'}
                  tabIndex={activeTab === 'detail' ? 0 : -1}
                  className={tabButtonClassName('detail')}
                  onClick={() => setActiveTab('detail')}
                  onKeyDown={(event) => handleTabKeyDown(event, 'detail')}
                >
                  디버그 보기
                </button>
              </div>
            </div>

            <div
              data-testid="analysis-basis-tab-panel"
              className="min-h-[18rem]"
            >
              <div
                id={processPanelId}
                role="tabpanel"
                aria-labelledby={processTabId}
                hidden={activeTab !== 'process'}
                className={activeTab === 'process' ? 'space-y-3' : 'hidden'}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    응답 과정
                  </span>
                  <div className="flex items-center gap-1.5 text-2xs text-slate-500">
                    {handoffHistory && handoffHistory.length > 0 && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        handoff {handoffHistory.length}회
                      </span>
                    )}
                    {toolCount > 0 && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        도구 {toolCount}개
                      </span>
                    )}
                    {traceId && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        추적 ID
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                      처리 경로
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-medium ${processRoute.badgeClassName}`}
                    >
                      {processRoute.label}
                    </span>
                    {failureReasons.length > 0 && (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-2xs font-medium text-rose-700">
                        실패 {failureReasons.length}건
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {processRoute.description}
                  </p>
                  {referencedServers.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                        참조 서버
                      </span>
                      {referencedServers.map((server) => (
                        <span
                          key={server}
                          className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-600"
                        >
                          {server}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {executionPath.length > 0 && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                      실행 경로
                    </p>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {executionPath.join(' → ')}
                    </p>
                  </div>
                )}

                {toolResultSummaries && toolResultSummaries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                      도구 결과 요약
                    </p>
                    <div className="space-y-2">
                      {toolResultSummaries.map((toolResult, index) => {
                        const toolPresentation = getToolPresentation(
                          toolResult.toolName
                        );
                        const failureReason = classifyFailureReason(
                          toolResult.summary,
                          toolResult.preview
                        );

                        return (
                          <div
                            key={`${toolResult.toolName}-${index}`}
                            className="rounded border border-slate-200 bg-slate-50 p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-xs font-medium text-slate-700"
                                title={
                                  toolPresentation.description ?? undefined
                                }
                              >
                                {toolPresentation.label}
                              </span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500">
                                {toolResult.status === 'failed'
                                  ? '실패'
                                  : '완료'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {toolResult.summary}
                            </p>
                            {toolResult.status === 'failed' && (
                              <p className="mt-2 text-2xs text-rose-700">
                                {failureReason.label}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {runtimeSummaryItems.length > 0 && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                      실행 특성
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {runtimeSummaryItems.map((item) => (
                        <span
                          key={item}
                          className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    {modeSelectionLabel && (
                      <p className="mt-2 text-xs text-slate-600">
                        라우팅 근거: {modeSelectionLabel}
                      </p>
                    )}
                    {resolvedModeDescription && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {resolvedModeDescription}
                      </p>
                    )}
                  </div>
                )}

                {details && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                      상세 분석
                    </p>
                    <div className="overflow-hidden rounded-md border border-slate-200 bg-white p-2">
                      <RenderMarkdownContent
                        content={details}
                        className="text-chat leading-relaxed break-words [overflow-wrap:anywhere]"
                      />
                    </div>
                  </div>
                )}

                {thinkingSteps && thinkingSteps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                      처리 단계 요약
                    </p>
                    <div className="space-y-2">
                      {thinkingSteps.map((step, index) => {
                        const stepPresentation =
                          getThinkingStepPresentation(step);
                        const summaryText =
                          step.description ||
                          step.content ||
                          stepPresentation.description ||
                          '응답 구성에 필요한 단계를 수행했습니다.';

                        return (
                          <div
                            key={step.id || `${step.step || 'step'}-${index}`}
                            className="rounded border border-slate-200 bg-slate-50 p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">
                                {stepPresentation.title || `단계 ${index + 1}`}
                              </span>
                              {step.status && (
                                <span className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500">
                                  {STEP_STATUS_LABELS[step.status] ??
                                    step.status}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {summaryText}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div
                id={detailPanelId}
                role="tabpanel"
                aria-labelledby={detailTabId}
                hidden={activeTab !== 'detail'}
                className={activeTab === 'detail' ? 'space-y-3' : 'hidden'}
              >
                {hasTechnicalDetails ? (
                  <>
                    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                          디버그 보기
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          추적 ID, raw 경로, 내부 도구명, 디버그 번들을 확인할
                          수 있습니다.
                        </p>
                      </div>
                      <CopyActionButton
                        text={debugBundle}
                        label="디버그 번들 복사"
                      />
                    </div>

                    {traceId && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                          추적 가능 ID
                        </p>
                        <code className="block break-all font-mono text-[11px] text-slate-700">
                          {traceId}
                        </code>
                      </div>
                    )}

                    {debugDetails && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                          추가 메타데이터
                        </p>
                        <div className="overflow-hidden rounded-md border border-slate-200 bg-white p-2">
                          <RenderMarkdownContent
                            content={debugDetails}
                            className="text-chat leading-relaxed break-words [overflow-wrap:anywhere]"
                          />
                        </div>
                      </div>
                    )}

                    {technicalExecutionPath.length > 0 && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                          실행 경로
                        </p>
                        <p className="text-xs leading-relaxed text-slate-700">
                          {technicalExecutionPath.join(' → ')}
                        </p>
                      </div>
                    )}

                    {handoffHistory && handoffHistory.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                          전달 이력
                        </p>
                        <div className="space-y-2">
                          {handoffHistory.map((handoff, index) => (
                            <div
                              key={`${handoff.from}-${handoff.to}-${index}`}
                              className="rounded border border-slate-200 bg-slate-50 p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-slate-700">
                                  {handoff.from} → {handoff.to}
                                </span>
                                <span className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500">
                                  {index + 1}단계
                                </span>
                              </div>
                              <p className="mt-1 text-2xs text-slate-500">
                                {getAgentRoleLabel(handoff.from)} →{' '}
                                {getAgentRoleLabel(handoff.to)}
                              </p>
                              {handoff.reason && (
                                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                  {handoff.reason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {toolResultSummaries && toolResultSummaries.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                          도구 결과 요약
                        </p>
                        <div className="space-y-2">
                          {toolResultSummaries.map((toolResult, index) => {
                            const toolPresentation = getToolPresentation(
                              toolResult.toolName
                            );
                            const failureReason = classifyFailureReason(
                              toolResult.summary,
                              toolResult.preview
                            );

                            return (
                              <div
                                key={`${toolResult.toolName}-${index}`}
                                className="rounded border border-slate-200 bg-slate-50 p-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span
                                        className="text-xs font-medium text-slate-700"
                                        title={
                                          toolPresentation.description ??
                                          undefined
                                        }
                                      >
                                        {toolPresentation.label}
                                      </span>
                                      <span
                                        className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500"
                                        title={`${toolResult.toolName} 내부 도구명`}
                                      >
                                        {toolResult.toolName}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500">
                                    {toolResult.status === 'failed'
                                      ? '실패'
                                      : '완료'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                  {toolResult.summary}
                                </p>
                                {toolResult.status === 'failed' && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-2xs font-medium text-rose-700">
                                      {failureReason.code}
                                    </span>
                                    <span className="text-2xs text-slate-600">
                                      {failureReason.label}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {thinkingSteps && thinkingSteps.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">
                          단계별 처리 내역
                        </p>
                        <div className="space-y-2">
                          {thinkingSteps.map((step, index) => (
                            <div
                              key={step.id || `${step.step || 'step'}-${index}`}
                              className="rounded border border-slate-200 bg-slate-50 p-2"
                            >
                              {(() => {
                                const stepPresentation =
                                  getThinkingStepPresentation(step);

                                return (
                                  <>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            className="text-xs font-medium text-slate-700"
                                            title={
                                              stepPresentation.description ??
                                              undefined
                                            }
                                          >
                                            {stepPresentation.title ||
                                              `단계 ${index + 1}`}
                                          </span>
                                          {stepPresentation.technicalName && (
                                            <span
                                              className="rounded bg-white px-1.5 py-0.5 text-2xs text-slate-500"
                                              title={
                                                stepPresentation.description ??
                                                `${stepPresentation.technicalName} 내부 도구명`
                                              }
                                            >
                                              {stepPresentation.technicalName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-2xs text-slate-500">
                                        {step.status && (
                                          <span className="rounded bg-white px-1.5 py-0.5">
                                            {STEP_STATUS_LABELS[step.status] ??
                                              step.status}
                                          </span>
                                        )}
                                        {typeof step.duration === 'number' && (
                                          <span className="rounded bg-white px-1.5 py-0.5">
                                            {step.duration}ms
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {stepPresentation.description && (
                                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                        {stepPresentation.description}
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {runtimeSummaryItems.length > 0 && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                          실행 특성
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {runtimeSummaryItems.map((item) => (
                            <span
                              key={item}
                              className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                        {modeSelectionLabel && (
                          <p className="mt-2 text-xs text-slate-600">
                            라우팅 근거: {modeSelectionLabel}
                          </p>
                        )}
                        {resolvedModeDescription && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {resolvedModeDescription}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[14rem] items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        기술 정보 없음
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        이번 응답에는 추가 추적 정보나 상세 실행 이력이
                        없습니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {basis.analysisMode && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-slate-500">
                분석 강도
              </p>
              <p className="text-xs text-slate-700">
                {ANALYSIS_MODE_LABELS[basis.analysisMode]}
              </p>
            </div>
          )}

          {/* 데이터 소스 */}
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">데이터:</span>
            <span className="text-gray-700">{basis.dataSource}</span>
          </div>

          {/* AI 엔진 */}
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">엔진:</span>
            <span className={getEngineColor(basis.engine)}>{basis.engine}</span>
            {basis.ragUsed && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">
                RAG
              </span>
            )}
          </div>

          {/* 호출된 도구 */}
          {meaningfulTools && meaningfulTools.length > 0 && (
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="text-gray-500 shrink-0">도구:</span>
              <div className="flex flex-wrap gap-1">
                {meaningfulTools.map((tool) => (
                  <span
                    key={tool}
                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs"
                    title={getToolDescription(tool) ?? undefined}
                  >
                    {getToolLabel(tool)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 시간 범위 */}
          {basis.timeRange && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500">기간:</span>
              <span className="text-gray-700">{basis.timeRange}</span>
            </div>
          )}

          {/* 서버 수 */}
          {basis.serverCount && (
            <div className="flex items-center gap-2">
              <span className="ml-5 text-gray-500">분석 서버:</span>
              <span className="text-gray-700">{basis.serverCount}개</span>
            </div>
          )}

          {/* RAG 출처 목록 */}
          {basis.ragSources && basis.ragSources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-gray-600 font-medium text-xs">
                  RAG 참조 문서
                </span>
              </div>
              <div className="space-y-1 ml-5">
                {basis.ragSources.map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 shrink-0">[{idx + 1}]</span>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate flex-1 min-w-0"
                        title={source.url}
                      >
                        {source.title}
                      </a>
                    ) : (
                      <span
                        className="text-gray-700 truncate flex-1 min-w-0"
                        title={source.title}
                      >
                        {source.title}
                      </span>
                    )}
                    {source.url && (
                      <ExternalLink className="h-3 w-3 shrink-0 text-blue-400" />
                    )}
                    {source.sourceType !== 'web' && (
                      <span
                        className={`px-1 py-0.5 rounded text-2xs font-medium shrink-0 ${
                          source.similarity >= 0.8
                            ? 'bg-green-100 text-green-700'
                            : source.similarity >= 0.6
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {Math.round(source.similarity * 100)}%
                      </span>
                    )}
                    <span className="px-1 py-0.5 rounded bg-purple-50 text-purple-600 text-2xs shrink-0">
                      {source.sourceType === 'web' && source.url
                        ? extractDomain(source.url)
                        : source.sourceType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
