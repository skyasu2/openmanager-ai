import {
  getThinkingStepPresentation,
  getToolPresentation,
} from '@/lib/ai/utils/tool-presentation';
import type {
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { RenderMarkdownContent } from '@/utils/markdown-parser';
import {
  classifyFailureReason,
  type FailureReasonEntry,
  type ProcessRouteInfo,
  STEP_STATUS_LABELS,
} from './shared';

interface AnalysisBasisProcessPanelProps {
  active: boolean;
  details?: string | null;
  executionPath: string[];
  failureReasons: FailureReasonEntry[];
  handoffHistory?: ResponseHandoff[];
  modeSelectionLabel: string | null;
  panelId: string;
  processRoute: ProcessRouteInfo;
  referencedServers: string[];
  resolvedModeDescription: string | null;
  runtimeSummaryItems: string[];
  tabId: string;
  thinkingSteps?: AIThinkingStep[];
  toolCount: number;
  toolResultSummaries?: ToolResultSummary[];
  traceId?: string;
}

export function AnalysisBasisProcessPanel({
  active,
  details,
  executionPath,
  failureReasons,
  handoffHistory,
  modeSelectionLabel,
  panelId,
  processRoute,
  referencedServers,
  resolvedModeDescription,
  runtimeSummaryItems,
  tabId,
  thinkingSteps,
  toolCount,
  toolResultSummaries,
  traceId,
}: AnalysisBasisProcessPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!active}
      className={active ? 'space-y-3' : 'hidden'}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">응답 과정</span>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
            <span className="rounded bg-slate-100 px-1.5 py-0.5">추적 ID</span>
          )}
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            처리 경로
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${processRoute.badgeClassName}`}
          >
            {processRoute.label}
          </span>
          {failureReasons.length > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
              실패 {failureReasons.length}건
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {processRoute.description}
        </p>
        {referencedServers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              참조 서버
            </span>
            {referencedServers.map((server) => (
              <span
                key={server}
                className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600"
              >
                {server}
              </span>
            ))}
          </div>
        )}
      </div>

      {executionPath.length > 0 && (
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            실행 경로
          </p>
          <p className="text-xs leading-relaxed text-slate-700">
            {executionPath.join(' → ')}
          </p>
        </div>
      )}

      {toolResultSummaries && toolResultSummaries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            도구 결과 요약
          </p>
          <div className="space-y-2">
            {toolResultSummaries.map((toolResult, index) => {
              const toolPresentation = getToolPresentation(toolResult.toolName);
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
                      title={toolPresentation.description ?? undefined}
                    >
                      {toolPresentation.label}
                    </span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
                      {toolResult.status === 'failed' ? '실패' : '완료'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {toolResult.summary}
                  </p>
                  {toolResult.status === 'failed' && (
                    <p className="mt-2 text-xs text-rose-700">
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
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
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
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
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
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            처리 단계 요약
          </p>
          <div className="space-y-2">
            {thinkingSteps.map((step, index) => {
              const stepPresentation = getThinkingStepPresentation(step);
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
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
                        {STEP_STATUS_LABELS[step.status] ?? step.status}
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
  );
}
