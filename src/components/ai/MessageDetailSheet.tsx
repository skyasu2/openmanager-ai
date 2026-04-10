'use client';

import {
  ArrowRight,
  Bot,
  Brain,
  Check,
  Copy,
  Database,
  ExternalLink,
  Hash,
  Wrench,
} from 'lucide-react';
import { memo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveAssistantResponseView } from '@/lib/ai/utils/assistant-response-view';
import { cn } from '@/lib/utils';
import type {
  AnalysisBasis,
  EnhancedChatMessage,
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingProcessVisualizer } from './ThinkingProcessVisualizer';

// ─────────────────────────────────────────────
// 서브 섹션 컴포넌트
// ─────────────────────────────────────────────

const SectionHeader = memo<{ icon: React.ReactNode; title: string }>(
  ({ icon, title }) => (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
    </div>
  )
);
SectionHeader.displayName = 'SectionHeader';

const CopyButton = memo<{ text: string }>(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) return;

    void clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard access can fail on insecure/non-focused contexts.
      });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      aria-label="복사"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
});
CopyButton.displayName = 'CopyButton';

// ─────────────────────────────────────────────
// 섹션: 전체 응답
// ─────────────────────────────────────────────

const FullResponseSection = memo<{
  content: string;
  details?: string | null;
  shouldCollapse?: boolean;
}>(({ content, details, shouldCollapse }) => {
  const fullContent =
    shouldCollapse && details ? `${content}\n\n---\n\n${details}` : content;

  return (
    <section aria-label="전체 응답">
      <SectionHeader icon={<Bot className="h-3.5 w-3.5" />} title="전체 응답" />
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <MarkdownRenderer
          content={fullContent}
          className="text-sm leading-relaxed text-slate-700"
        />
      </div>
    </section>
  );
});
FullResponseSection.displayName = 'FullResponseSection';

// ─────────────────────────────────────────────
// 섹션: AI 처리 단계
// ─────────────────────────────────────────────

const ThinkingSection = memo<{ steps: AIThinkingStep[] }>(({ steps }) => (
  <section aria-label="AI 처리 단계">
    <SectionHeader
      icon={<Brain className="h-3.5 w-3.5" />}
      title={`AI 처리 단계 (${steps.length})`}
    />
    <ThinkingProcessVisualizer
      steps={steps}
      isActive={false}
      className="rounded-lg border border-purple-100 bg-purple-50/40"
    />
  </section>
));
ThinkingSection.displayName = 'ThinkingSection';

// ─────────────────────────────────────────────
// 섹션: Handoff 경로
// ─────────────────────────────────────────────

const HandoffSection = memo<{ history: ResponseHandoff[] }>(({ history }) => (
  <section aria-label="에이전트 전달 경로">
    <SectionHeader
      icon={<ArrowRight className="h-3.5 w-3.5" />}
      title="에이전트 전달 경로"
    />
    <ol className="space-y-2">
      {history.map((hop, idx) => (
        <li
          key={`${hop.from}-${hop.to}-${idx}`}
          className="flex items-start gap-2"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-2xs font-bold text-indigo-600">
            {idx + 1}
          </span>
          <div className="flex-1 rounded-lg border border-slate-100 bg-white p-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                {hop.from}
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                {hop.to}
              </span>
            </div>
            {hop.reason && (
              <p className="mt-1 text-xs text-slate-500">{hop.reason}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  </section>
));
HandoffSection.displayName = 'HandoffSection';

// ─────────────────────────────────────────────
// 섹션: Tool 결과
// ─────────────────────────────────────────────

const ToolResultsSection = memo<{ summaries: ToolResultSummary[] }>(
  ({ summaries }) => (
    <section aria-label="도구 실행 결과">
      <SectionHeader
        icon={<Wrench className="h-3.5 w-3.5" />}
        title={`도구 실행 결과 (${summaries.length})`}
      />
      <ul className="space-y-2">
        {summaries.map((s, idx) => (
          <li
            key={`${s.toolName}-${idx}`}
            className="rounded-lg border border-slate-100 bg-white p-2.5"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                {s.toolName}
              </span>
              <span
                className={`rounded px-1 py-0.5 text-xs font-medium ${
                  s.status === 'completed'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {s.status === 'completed' ? '완료' : '실패'}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {s.summary}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
);
ToolResultsSection.displayName = 'ToolResultsSection';

// ─────────────────────────────────────────────
// 섹션: Trace ID + 메타
// ─────────────────────────────────────────────

const MetaSection = memo<{
  traceId?: string;
  basis: AnalysisBasis;
  processingTime?: number;
}>(({ traceId, basis, processingTime }) => (
  <section aria-label="메타 정보">
    <SectionHeader icon={<Hash className="h-3.5 w-3.5" />} title="메타 정보" />
    <dl className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
      {traceId && (
        <div className="flex items-center">
          <dt className="w-20 shrink-0 text-slate-500">Trace ID</dt>
          <dd className="flex items-center font-mono text-slate-700">
            <span className="truncate max-w-[200px]">{traceId}</span>
            <CopyButton text={traceId} />
          </dd>
        </div>
      )}
      <div className="flex items-center">
        <dt className="w-20 shrink-0 text-slate-500">엔진</dt>
        <dd className="text-slate-700">{basis.engine}</dd>
      </div>
      <div className="flex items-center">
        <dt className="w-20 shrink-0 text-slate-500">데이터 소스</dt>
        <dd className="text-slate-700">{basis.dataSource}</dd>
      </div>
      {processingTime && (
        <div className="flex items-center">
          <dt className="w-20 shrink-0 text-slate-500">처리 시간</dt>
          <dd className="text-slate-700">{processingTime}ms</dd>
        </div>
      )}
      {basis.toolsCalled && basis.toolsCalled.length > 0 && (
        <div className="flex items-start">
          <dt className="w-20 shrink-0 text-slate-500">사용 도구</dt>
          <dd className="flex flex-wrap gap-1">
            {basis.toolsCalled.map((t: string) => (
              <span
                key={t}
                className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-600"
              >
                {t}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  </section>
));
MetaSection.displayName = 'MetaSection';

// ─────────────────────────────────────────────
// 섹션: RAG 출처
// ─────────────────────────────────────────────

const RagSourcesSection = memo<{
  sources: NonNullable<AnalysisBasis['ragSources']>;
}>(({ sources }) => (
  <section aria-label="RAG 출처">
    <SectionHeader
      icon={<Database className="h-3.5 w-3.5" />}
      title={`RAG 출처 (${sources.length})`}
    />
    <ul className="space-y-1.5">
      {sources.map((src, idx) => (
        <li
          key={idx}
          className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-2"
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-100 text-2xs font-bold text-indigo-600">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-slate-700">
                {src.title ?? src.url ?? `출처 ${idx + 1}`}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {src.similarity !== undefined && (
                  <span
                    className={cn(
                      'rounded px-1 py-0.5 text-xs font-medium',
                      src.similarity >= 0.8
                        ? 'bg-green-50 text-green-700'
                        : src.similarity >= 0.6
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {Math.round(src.similarity * 100)}%
                  </span>
                )}
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-600"
                    aria-label="원본 보기"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </section>
));
RagSourcesSection.displayName = 'RagSourcesSection';

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export type MessageDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: EnhancedChatMessage;
};

export const MessageDetailSheet = memo<MessageDetailSheetProps>(
  ({ open, onOpenChange, message }) => {
    const meta = message.metadata;
    const basis = meta?.analysisBasis;
    const assistantResponseView =
      message.role === 'assistant' && !message.isStreaming
        ? resolveAssistantResponseView(message.content, message.metadata)
        : null;
    const hasThinking =
      message.thinkingSteps && message.thinkingSteps.length > 0;
    const hasHandoff = meta?.handoffHistory && meta.handoffHistory.length > 0;
    const hasTools =
      meta?.toolResultSummaries && meta.toolResultSummaries.length > 0;
    const hasRag = basis?.ragSources && basis.ragSources.length > 0;

    const shouldCollapse = Boolean(
      assistantResponseView?.shouldCollapse && assistantResponseView.details
    );
    const responseContent = shouldCollapse
      ? (assistantResponseView?.summary ?? '')
      : (assistantResponseView?.summary ?? message.content);
    const hasFullResponse = Boolean(
      responseContent.trim() ||
        (shouldCollapse && assistantResponseView?.details?.trim())
    );

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0"
          aria-label="메시지 상세 정보"
        >
          <DialogHeader className="border-b border-slate-100 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bot className="h-4 w-4 text-purple-500" />
              메시지 상세
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              AI 처리 과정, 에이전트 경로, 도구 결과를 한 곳에서 확인합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* 전체 응답 */}
            {hasFullResponse && (
              <FullResponseSection
                content={responseContent}
                details={assistantResponseView?.details}
                shouldCollapse={shouldCollapse}
              />
            )}

            {/* AI 처리 단계 */}
            {hasThinking && (
              <ThinkingSection
                steps={message.thinkingSteps as AIThinkingStep[]}
              />
            )}

            {/* Handoff 경로 */}
            {hasHandoff && (
              <HandoffSection
                history={meta.handoffHistory as ResponseHandoff[]}
              />
            )}

            {/* Tool 결과 */}
            {hasTools && (
              <ToolResultsSection
                summaries={meta.toolResultSummaries as ToolResultSummary[]}
              />
            )}

            {/* 메타 정보 */}
            {basis && (
              <MetaSection
                traceId={meta?.traceId}
                basis={basis}
                processingTime={meta?.processingTime}
              />
            )}

            {/* RAG 출처 */}
            {hasRag && (
              <RagSourcesSection
                sources={
                  basis.ragSources as NonNullable<AnalysisBasis['ragSources']>
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

MessageDetailSheet.displayName = 'MessageDetailSheet';
