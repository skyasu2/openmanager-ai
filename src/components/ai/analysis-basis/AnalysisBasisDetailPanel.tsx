import { Check, Copy } from 'lucide-react';
import { type FC, useEffect, useRef, useState } from 'react';
import {
  getThinkingStepPresentation,
  getToolPresentation,
} from '@/lib/ai/utils/tool-presentation';
import type {
  ProviderAttemptTelemetry,
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { RenderMarkdownContent } from '@/utils/markdown-parser';
import {
  classifyFailureReason,
  getAgentRoleLabel,
  type ProcessRouteInfo,
  STEP_STATUS_LABELS,
} from './shared';

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
      className={`inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 ${className}`}
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

interface AnalysisBasisDetailPanelProps {
  active: boolean;
  debugBundle: string;
  debugDetails?: string | null;
  hasTechnicalDetails: boolean;
  handoffHistory?: ResponseHandoff[];
  fallbackReason?: string;
  modeSelectionLabel: string | null;
  modelId?: string;
  panelId: string;
  processRoute: ProcessRouteInfo;
  provider?: string;
  providerAttempts?: ProviderAttemptTelemetry[];
  resolvedModeDescription: string | null;
  runtimeSummaryItems: string[];
  tabId: string;
  technicalExecutionPath: string[];
  thinkingSteps?: AIThinkingStep[];
  toolResultSummaries?: ToolResultSummary[];
  traceId?: string;
  ttfbMs?: number;
  usedFallback?: boolean;
}

export function AnalysisBasisDetailPanel({
  active,
  debugBundle,
  debugDetails,
  hasTechnicalDetails,
  handoffHistory,
  fallbackReason,
  modeSelectionLabel,
  modelId,
  panelId,
  resolvedModeDescription,
  provider,
  providerAttempts,
  runtimeSummaryItems,
  tabId,
  technicalExecutionPath,
  thinkingSteps,
  toolResultSummaries,
  traceId,
  ttfbMs,
  usedFallback,
}: AnalysisBasisDetailPanelProps) {
  const providerLabel =
    provider && modelId ? `${provider}/${modelId}` : (provider ?? modelId);
  const hasProviderTelemetry =
    Boolean(providerLabel) ||
    Boolean(providerAttempts && providerAttempts.length > 0) ||
    typeof usedFallback === 'boolean' ||
    Boolean(fallbackReason) ||
    typeof ttfbMs === 'number';

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!active}
      className={active ? 'space-y-3' : 'hidden'}
    >
      {hasTechnicalDetails ? (
        <>
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-2.5">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                디버그 보기
              </p>
              <p className="mt-1 text-xs text-slate-600">
                추적 ID, raw 경로, 내부 도구명, 디버그 번들을 확인할 수
                있습니다.
              </p>
            </div>
            <CopyActionButton text={debugBundle} label="디버그 번들 복사" />
          </div>

          {traceId && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                추적 가능 ID
              </p>
              <code className="block font-mono text-xs break-all text-slate-700">
                {traceId}
              </code>
            </div>
          )}

          {debugDetails && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                추가 메타데이터
              </p>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white p-2">
                <RenderMarkdownContent
                  content={debugDetails}
                  className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words"
                />
              </div>
            </div>
          )}

          {technicalExecutionPath.length > 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                실행 경로
              </p>
              <p className="text-xs leading-relaxed text-slate-700">
                {technicalExecutionPath.join(' → ')}
              </p>
            </div>
          )}

          {hasProviderTelemetry && (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Provider 시도
              </p>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {providerLabel && (
                    <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700">
                      최종 {providerLabel}
                    </span>
                  )}
                  {typeof usedFallback === 'boolean' && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        usedFallback
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {usedFallback ? 'fallback 사용' : 'fallback 없음'}
                    </span>
                  )}
                  {typeof ttfbMs === 'number' && (
                    <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700">
                      TTFB {ttfbMs}ms
                    </span>
                  )}
                </div>
                {fallbackReason && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    전환 사유: {fallbackReason}
                  </p>
                )}
              </div>

              {providerAttempts && providerAttempts.length > 0 && (
                <div className="space-y-2">
                  {providerAttempts.map((attempt, index) => {
                    const attemptProviderLabel = attempt.modelId
                      ? `${attempt.provider}/${attempt.modelId}`
                      : attempt.provider;
                    return (
                      <div
                        key={`${attempt.provider}-${attempt.modelId ?? 'model'}-${attempt.attempt ?? index}`}
                        className="rounded border border-slate-200 bg-slate-50 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 text-xs font-medium break-all text-slate-700">
                            {attemptProviderLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                            {typeof attempt.attempt === 'number' && (
                              <span className="rounded bg-white px-1.5 py-0.5">
                                {attempt.attempt}회
                              </span>
                            )}
                            {typeof attempt.durationMs === 'number' && (
                              <span className="rounded bg-white px-1.5 py-0.5">
                                {attempt.durationMs}ms
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium ${
                                attempt.error
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {attempt.error ? '실패' : '성공'}
                            </span>
                          </div>
                        </div>
                        {attempt.error && (
                          <p className="mt-1 text-xs leading-relaxed [overflow-wrap:anywhere] break-words text-slate-600">
                            {attempt.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {handoffHistory && handoffHistory.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
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
                      <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
                        {index + 1}단계
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
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
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
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
                              title={toolPresentation.description ?? undefined}
                            >
                              {toolPresentation.label}
                            </span>
                            <span
                              className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500"
                              title={`${toolResult.toolName} 내부 도구명`}
                            >
                              {toolResult.toolName}
                            </span>
                          </div>
                        </div>
                        <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
                          {toolResult.status === 'failed' ? '실패' : '완료'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {toolResult.summary}
                      </p>
                      {toolResult.status === 'failed' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                            {failureReason.code}
                          </span>
                          <span className="text-xs text-slate-600">
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
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                단계별 처리 내역
              </p>
              <div className="space-y-2">
                {thinkingSteps.map((step, index) => {
                  const stepPresentation = getThinkingStepPresentation(step);

                  return (
                    <div
                      key={step.id || `${step.step || 'step'}-${index}`}
                      className="rounded border border-slate-200 bg-slate-50 p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="text-xs font-medium text-slate-700"
                              title={stepPresentation.description ?? undefined}
                            >
                              {stepPresentation.title || `단계 ${index + 1}`}
                            </span>
                            {stepPresentation.technicalName && (
                              <span
                                className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500"
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
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          {step.status && (
                            <span className="rounded bg-white px-1.5 py-0.5">
                              {STEP_STATUS_LABELS[step.status] ?? step.status}
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {runtimeSummaryItems.length > 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
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
            <p className="text-sm font-medium text-slate-700">기술 정보 없음</p>
            <p className="mt-1 text-xs text-slate-500">
              이번 응답에는 추가 추적 정보나 상세 실행 이력이 없습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
