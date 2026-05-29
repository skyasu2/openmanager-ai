import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import {
  ARTIFACT_INTENT_RULE_VERSION,
  type ChatArtifactIntent,
  classifyChatArtifactIntent,
  fetchLLMChatArtifactIntent,
  shouldUseLLMChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import type { MonitoringChatArtifact } from '@/lib/ai/domains/monitoring/artifact-registry';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { FileAttachment } from '../useFileAttachments';
import { startChatArtifactGeneration } from './chat-artifact-execution';
import type { GuidanceCtaTarget } from './chat-artifact-metadata';

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
    return {
      kind: 'incident-report',
      reason: 'incident_report_action_pattern',
      ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
    };
  }

  return {
    kind: 'monitoring-analysis',
    reason: 'monitoring_action_pattern',
    ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
  };
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

export function runArtifactGuidanceCta({
  target,
  disableSessionLimit,
  sessionLimitReached,
  sessionMessageCount,
  hybridIsLoading,
  artifactIntentInFlightRef,
  resetRequestState,
  onSessionLimitReached,
  ...runtime
}: ArtifactGenerationRuntimeContext & {
  target: GuidanceCtaTarget;
  disableSessionLimit: boolean | undefined;
  sessionLimitReached: boolean;
  sessionMessageCount: number;
  hybridIsLoading: boolean;
  artifactIntentInFlightRef: MutableRefObject<boolean>;
  resetRequestState: ResetRequestState;
  onSessionLimitReached?: (messageCount: number) => void;
}): boolean {
  return submitArtifactGuidanceCta({
    target,
    disableSessionLimit,
    sessionLimitReached,
    sessionMessageCount,
    hybridIsLoading,
    artifactInFlight: runtime.artifactInFlightRef.current,
    artifactIntentInFlight: artifactIntentInFlightRef.current,
    setError: runtime.setError,
    resetRequestState,
    onSessionLimitReached,
    startArtifactGeneration: ({ artifactIntent, query }) =>
      startChatArtifactGeneration({
        artifactIntent,
        query,
        sessionId: runtime.sessionId,
        queryAsOfDataSlot: runtime.queryAsOfDataSlot,
        messages: runtime.messagesRef.current,
        messagesRef: runtime.messagesRef,
        setMessages: runtime.setMessages,
        setError: runtime.setError,
        setArtifactIsLoading: runtime.setArtifactIsLoading,
        artifactRequestIdRef: runtime.artifactRequestIdRef,
        artifactAbortControllerRef: runtime.artifactAbortControllerRef,
        artifactInFlightRef: runtime.artifactInFlightRef,
      }),
  });
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
  const regexIntent = classifyChatArtifactIntent(query);
  let artifactIntent = regexIntent;

  if (regexIntent.kind === 'none' && shouldUseLLMChatArtifactIntent(query)) {
    const intentAbortController = new AbortController();
    artifactIntentInFlightRef.current = true;
    runtime.artifactAbortControllerRef.current = intentAbortController;
    try {
      artifactIntent = await fetchLLMChatArtifactIntent(
        query,
        intentAbortController.signal
      );
    } finally {
      artifactIntentInFlightRef.current = false;
      if (
        runtime.artifactAbortControllerRef.current === intentAbortController
      ) {
        runtime.artifactAbortControllerRef.current = null;
      }
    }

    if (intentAbortController.signal.aborted) {
      return true;
    }
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

function isExecutableChatArtifactIntent(
  intent: ChatArtifactIntent
): intent is ExecutableChatArtifactIntent {
  return (
    intent.kind === 'incident-report' ||
    intent.kind === 'monitoring-analysis' ||
    intent.kind === 'server-monitoring-analysis' ||
    intent.kind === 'server-snapshot' ||
    intent.kind === 'ops-procedure'
  );
}
