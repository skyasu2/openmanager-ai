import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import {
  type ChatArtifactIntent,
  normalizeChatArtifactIntent,
  withArtifactIntentRuleVersion,
} from '@/lib/ai/chat-artifacts/artifact-intent-contract';
import type { MonitoringChatArtifact } from '@/lib/ai/domains/monitoring/artifact-registry';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { AsyncQueryResult } from '../useAsyncAIQuery';
import type { FileAttachment } from '../useFileAttachments';
import { startChatArtifactGeneration } from './chat-artifact-execution';
import type { GuidanceCtaTarget } from './chat-artifact-metadata';
import { resolvePostDecisionArtifactIntent } from './post-decision-artifact';

type ChatArtifact = MonitoringChatArtifact;

type ForcedGuidanceArtifactIntent = Extract<
  ChatArtifactIntent,
  { kind: 'incident-report' | 'monitoring-analysis' }
>;

type ExecutableChatArtifactIntent = Extract<
  ChatArtifactIntent,
  { kind: ChatArtifact['kind'] }
>;

type SetMessages = (messages: UIMessage[]) => void;
type ResetRequestState = (
  query: string,
  attachments?: FileAttachment[] | null,
  pendingQuery?: string
) => void;

type ArtifactGenerationRuntimeContext = {
  sessionId: string;
  queryAsOfDataSlot?: JobDataSlot;
  messagesRef: MutableRefObject<UIMessage[]>;
  setMessages: SetMessages;
  setError: (error: string | null) => void;
  setArtifactIsLoading: (loading: boolean) => void;
  artifactRequestIdRef: MutableRefObject<string | null>;
  artifactAbortControllerRef: MutableRefObject<AbortController | null>;
  artifactInFlightRef: MutableRefObject<boolean>;
};

export function createForcedGuidanceArtifactIntent(
  target: GuidanceCtaTarget
): ForcedGuidanceArtifactIntent {
  if (target === 'incident-report') {
    return withArtifactIntentRuleVersion(
      {
        kind: 'incident-report',
        reason: 'incident_report_action_pattern',
      },
      'frontend'
    ) as ForcedGuidanceArtifactIntent;
  }

  return withArtifactIntentRuleVersion(
    {
      kind: 'monitoring-analysis',
      reason: 'monitoring_action_pattern',
    },
    'frontend'
  ) as ForcedGuidanceArtifactIntent;
}

export function createForcedGuidanceArtifactQuery(
  target: GuidanceCtaTarget
): string {
  return target === 'incident-report'
    ? '장애 보고서 작성해줘'
    : '전체 서버 이상감지 돌려줘';
}

export function submitArtifactGuidanceCta({
  target,
  disableSessionLimit,
  sessionLimitReached,
  sessionMessageCount,
  hybridIsLoading,
  artifactInFlight,
  artifactIntentInFlight,
  setError,
  resetRequestState,
  startArtifactGeneration,
  onSessionLimitReached,
}: {
  target: GuidanceCtaTarget;
  disableSessionLimit: boolean | undefined;
  sessionLimitReached: boolean;
  sessionMessageCount: number;
  hybridIsLoading: boolean;
  artifactInFlight: boolean;
  artifactIntentInFlight: boolean;
  setError: (error: string | null) => void;
  resetRequestState: ResetRequestState;
  startArtifactGeneration: (request: {
    artifactIntent: ForcedGuidanceArtifactIntent;
    query: string;
  }) => void;
  onSessionLimitReached?: (messageCount: number) => void;
}): boolean {
  if (!disableSessionLimit && sessionLimitReached) {
    onSessionLimitReached?.(sessionMessageCount);
    return false;
  }

  if (hybridIsLoading) {
    setError('AI 응답이 진행 중입니다. 완료 후 실행해주세요.');
    return false;
  }

  if (artifactInFlight || artifactIntentInFlight) {
    setError('아티팩트 생성이 진행 중입니다. 완료 후 다음 요청을 보내주세요.');
    return false;
  }

  const query = createForcedGuidanceArtifactQuery(target);
  const artifactIntent = createForcedGuidanceArtifactIntent(target);

  setError(null);
  resetRequestState(query);
  startArtifactGeneration({ artifactIntent, query });
  return true;
}

export async function tryHandleChatArtifactRequest({
  query,
  attachments,
  messages,
  resetRequestState,
  artifactIntentInFlightRef,
  ...runtime
}: ArtifactGenerationRuntimeContext & {
  query: string;
  attachments?: FileAttachment[];
  messages: UIMessage[];
  resetRequestState: ResetRequestState;
  artifactIntentInFlightRef: MutableRefObject<boolean>;
}): Promise<boolean> {
  const intentAbortController = new AbortController();
  artifactIntentInFlightRef.current = true;
  runtime.artifactAbortControllerRef.current = intentAbortController;

  const artifactIntent = await fetchBffChatArtifactIntent(
    query,
    intentAbortController.signal
  );

  artifactIntentInFlightRef.current = false;
  if (runtime.artifactAbortControllerRef.current === intentAbortController) {
    runtime.artifactAbortControllerRef.current = null;
  }

  if (intentAbortController.signal.aborted) {
    return true;
  }

  if (!isExecutableChatArtifactIntent(artifactIntent)) {
    return false;
  }

  resetRequestState(query, attachments || null);
  startChatArtifactGeneration({
    artifactIntent,
    query,
    sessionId: runtime.sessionId,
    queryAsOfDataSlot: runtime.queryAsOfDataSlot,
    messages,
    messagesRef: runtime.messagesRef,
    setMessages: runtime.setMessages,
    setError: runtime.setError,
    setArtifactIsLoading: runtime.setArtifactIsLoading,
    artifactRequestIdRef: runtime.artifactRequestIdRef,
    artifactAbortControllerRef: runtime.artifactAbortControllerRef,
    artifactInFlightRef: runtime.artifactInFlightRef,
  });
  return true;
}

async function fetchBffChatArtifactIntent(
  query: string,
  signal?: AbortSignal
): Promise<ChatArtifactIntent> {
  try {
    const response = await fetch('/api/ai/artifact-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      return withArtifactIntentRuleVersion({ kind: 'none' }, 'bff');
    }
    return normalizeChatArtifactIntent(await response.json(), 'bff');
  } catch {
    return withArtifactIntentRuleVersion({ kind: 'none' }, 'bff');
  }
}

export function tryHandlePostDecisionChatArtifactResult({
  result,
  query,
  artifactIntentInFlightRef,
  ...runtime
}: ArtifactGenerationRuntimeContext & {
  result: AsyncQueryResult;
  query: string;
  artifactIntentInFlightRef: MutableRefObject<boolean>;
}): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return false;
  if (
    runtime.artifactInFlightRef.current ||
    artifactIntentInFlightRef.current
  ) {
    return false;
  }

  const artifactIntent = resolvePostDecisionArtifactIntent({
    result,
    query: normalizedQuery,
  });
  if (!artifactIntent) return false;

  startChatArtifactGeneration({
    artifactIntent,
    query: normalizedQuery,
    sessionId: runtime.sessionId,
    queryAsOfDataSlot: runtime.queryAsOfDataSlot,
    messages: withoutTrailingMatchingUserMessage(
      runtime.messagesRef.current,
      normalizedQuery
    ),
    messagesRef: runtime.messagesRef,
    setMessages: runtime.setMessages,
    setError: runtime.setError,
    setArtifactIsLoading: runtime.setArtifactIsLoading,
    artifactRequestIdRef: runtime.artifactRequestIdRef,
    artifactAbortControllerRef: runtime.artifactAbortControllerRef,
    artifactInFlightRef: runtime.artifactInFlightRef,
  });
  return true;
}

function isExecutableChatArtifactIntent(
  intent: ChatArtifactIntent
): intent is ExecutableChatArtifactIntent {
  return (
    intent.kind === 'incident-report' ||
    intent.kind === 'monitoring-analysis' ||
    intent.kind === 'server-monitoring-analysis' ||
    intent.kind === 'ops-procedure'
  );
}

function withoutTrailingMatchingUserMessage(
  messages: UIMessage[],
  query: string
): UIMessage[] {
  const lastMessage = messages.at(-1);
  if (lastMessage?.role !== 'user') return messages;

  return readMessageText(lastMessage).trim() === query
    ? messages.slice(0, -1)
    : messages;
}

function readMessageText(message: UIMessage): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(message.parts)) return '';

  return message.parts
    .map((part) =>
      part && typeof part === 'object' && 'text' in part
        ? String(part.text ?? '')
        : ''
    )
    .join('');
}
