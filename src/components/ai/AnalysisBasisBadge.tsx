'use client';

import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import {
  type FC,
  type KeyboardEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnalysisBasisDetailPanel } from './analysis-basis/AnalysisBasisDetailPanel';
import { AnalysisBasisMetadata } from './analysis-basis/AnalysisBasisMetadata';
import { AnalysisBasisProcessPanel } from './analysis-basis/AnalysisBasisProcessPanel';
import {
  type AnalysisBasisBadgeProps,
  type AnalysisBasisTab,
  buildCollapsedSummary,
  buildDebugBundle,
  buildExecutionPath,
  buildFailureReasons,
  buildReferencedServers,
  buildRuntimeSummaryItems,
  buildTechnicalExecutionPath,
  getModeSelectionLabel,
  getResolvedModeDescription,
  hasTechnicalAnalysisDetails,
  inferProcessRoute,
} from './analysis-basis/shared';

/**
 * 분석 근거 뱃지 컴포넌트
 *
 * AI 응답의 투명성을 위해 분석에 사용된 근거 정보를 표시합니다.
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
  provider,
  modelId,
  providerAttempts,
  usedFallback,
  fallbackReason,
  ttfbMs,
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

  const meaningfulTools = basis.toolsCalled?.filter(
    (tool) => tool !== 'finalAnswer'
  );
  const executionPath = useMemo(
    () => buildExecutionPath(handoffHistory),
    [handoffHistory]
  );
  const technicalExecutionPath = useMemo(
    () => buildTechnicalExecutionPath(handoffHistory),
    [handoffHistory]
  );
  const toolCount = toolResultSummaries?.length ?? meaningfulTools?.length ?? 0;
  const failureReasons = useMemo(
    () => buildFailureReasons(toolResultSummaries),
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
      buildReferencedServers({
        basis,
        debugDetails,
        details,
        handoffHistory,
        thinkingSteps,
        toolResultSummaries,
      }),
    [
      basis,
      debugDetails,
      details,
      handoffHistory,
      thinkingSteps,
      toolResultSummaries,
    ]
  );
  const debugBundle = useMemo(
    () =>
      buildDebugBundle({
        basis,
        executionPath,
        failureReasons,
        meaningfulTools,
        processRoute,
        referencedServers,
        toolResultSummaries,
        traceId,
        provider,
        modelId,
        providerAttempts,
        usedFallback,
        fallbackReason,
        ttfbMs,
      }),
    [
      basis,
      executionPath,
      failureReasons,
      fallbackReason,
      meaningfulTools,
      modelId,
      processRoute,
      provider,
      providerAttempts,
      referencedServers,
      ttfbMs,
      toolResultSummaries,
      traceId,
      usedFallback,
    ]
  );
  const { collapsedSummary, collapsedTitle } = useMemo(
    () =>
      buildCollapsedSummary({
        basis,
        executionPath,
        handoffCount: handoffHistory?.length ?? 0,
        meaningfulTools,
        toolCount,
      }),
    [basis, executionPath, handoffHistory?.length, meaningfulTools, toolCount]
  );
  const runtimeSummaryItems = useMemo(
    () =>
      buildRuntimeSummaryItems({
        latencyTier,
        modelId,
        processingTime,
        provider,
        resolvedMode,
        ttfbMs,
        usedFallback,
        fallbackReason,
      }),
    [
      fallbackReason,
      latencyTier,
      modelId,
      processingTime,
      provider,
      resolvedMode,
      ttfbMs,
      usedFallback,
    ]
  );
  const modeSelectionLabel = getModeSelectionLabel(modeSelectionSource);
  const resolvedModeDescription = getResolvedModeDescription(resolvedMode);
  const hasTechnicalDetails = hasTechnicalAnalysisDetails({
    debugDetails,
    handoffHistory,
    modeSelectionLabel,
    runtimeSummaryItems,
    technicalExecutionPath,
    thinkingSteps,
    toolResultSummaries,
    traceId,
    providerAttempts,
  });
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

      {isExpanded && (
        <div className="min-w-0 space-y-2 border-t border-gray-200 px-3 pt-1 pb-3">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  분석 보기
                </p>
                <p className="text-xs text-slate-500">
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
              <AnalysisBasisProcessPanel
                active={activeTab === 'process'}
                details={details}
                executionPath={executionPath}
                failureReasons={failureReasons}
                handoffHistory={handoffHistory}
                modeSelectionLabel={modeSelectionLabel}
                panelId={processPanelId}
                processRoute={processRoute}
                referencedServers={referencedServers}
                resolvedModeDescription={resolvedModeDescription}
                runtimeSummaryItems={runtimeSummaryItems}
                tabId={processTabId}
                thinkingSteps={thinkingSteps}
                toolCount={toolCount}
                toolResultSummaries={toolResultSummaries}
                traceId={traceId}
              />
              <AnalysisBasisDetailPanel
                active={activeTab === 'detail'}
                debugBundle={debugBundle}
                debugDetails={debugDetails}
                hasTechnicalDetails={hasTechnicalDetails}
                handoffHistory={handoffHistory}
                modeSelectionLabel={modeSelectionLabel}
                modelId={modelId}
                panelId={detailPanelId}
                processRoute={processRoute}
                provider={provider}
                providerAttempts={providerAttempts}
                resolvedModeDescription={resolvedModeDescription}
                runtimeSummaryItems={runtimeSummaryItems}
                tabId={detailTabId}
                technicalExecutionPath={technicalExecutionPath}
                thinkingSteps={thinkingSteps}
                toolResultSummaries={toolResultSummaries}
                traceId={traceId}
                ttfbMs={ttfbMs}
                usedFallback={usedFallback}
                fallbackReason={fallbackReason}
              />
            </div>
          </div>

          <AnalysisBasisMetadata
            basis={basis}
            meaningfulTools={meaningfulTools}
          />
        </div>
      )}
    </div>
  );
};
