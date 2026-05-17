import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import { resolveArtifactExecutor } from '@/lib/ai/chat-artifacts/artifact-executor-registry';
import type { ChatArtifactIntent } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { registerMonitoringArtifactExecutors } from '@/lib/ai/domains/monitoring/artifact-executors';
import type { MonitoringChatArtifact } from '@/lib/ai/domains/monitoring/artifact-registry';
import type { JobDataSlot } from '@/types/ai-jobs';
import {
  buildArtifactErrorMetadata,
  buildArtifactMetadata,
  createTextMessage,
  getArtifactErrorText,
  getArtifactLoadingText,
  getArtifactStepMessages,
  getArtifactSuccessText,
} from './chat-artifact-metadata';

registerMonitoringArtifactExecutors();

type ChatArtifact = MonitoringChatArtifact;

type ExecutableChatArtifactIntent = Extract<
  ChatArtifactIntent,
  { kind: ChatArtifact['kind'] }
>;

type SetMessages = (messages: UIMessage[]) => void;

export function startChatArtifactGeneration({
  artifactIntent,
  query,
  sessionId,
  queryAsOfDataSlot,
  messages,
  messagesRef,
  setMessages,
  setError,
  setArtifactIsLoading,
  artifactRequestIdRef,
  artifactAbortControllerRef,
  artifactInFlightRef,
}: {
  artifactIntent: ExecutableChatArtifactIntent;
  query: string;
  sessionId: string;
  queryAsOfDataSlot?: JobDataSlot;
  messages: UIMessage[];
  messagesRef: MutableRefObject<UIMessage[]>;
  setMessages: SetMessages;
  setError: (error: string | null) => void;
  setArtifactIsLoading: (loading: boolean) => void;
  artifactRequestIdRef: MutableRefObject<string | null>;
  artifactAbortControllerRef: MutableRefObject<AbortController | null>;
  artifactInFlightRef: MutableRefObject<boolean>;
}): void {
  const artifactKind = artifactIntent.kind;
  const token = Date.now().toString(36);
  const userMessage = createTextMessage({
    id: `artifact-user-${token}`,
    role: 'user',
    text: query,
  });
  const pendingAssistantMessage = createTextMessage({
    id: `artifact-assistant-${token}`,
    role: 'assistant',
    text: getArtifactLoadingText(artifactKind),
  });
  const fallbackArtifactMessages = [...messages, userMessage];
  const abortController = new AbortController();
  const stepTimers = getArtifactStepMessages(artifactKind)
    .slice(1)
    .map((step) =>
      setTimeout(() => {
        if (artifactRequestIdRef.current !== token) {
          return;
        }

        const stepMessage = createTextMessage({
          id: pendingAssistantMessage.id,
          role: 'assistant',
          text: step.text,
        });
        setMessages(
          replacePendingArtifactMessage({
            currentMessages: messagesRef.current,
            pendingMessageId: pendingAssistantMessage.id,
            fallbackArtifactMessages,
            nextAssistantMessage: stepMessage,
          })
        );
      }, step.delayMs)
    );

  setMessages([...fallbackArtifactMessages, pendingAssistantMessage]);
  artifactRequestIdRef.current = token;
  artifactAbortControllerRef.current = abortController;
  artifactInFlightRef.current = true;
  setArtifactIsLoading(true);

  void (async () => {
    try {
      const artifact = await generateChatArtifact({
        artifactIntent,
        query,
        sessionId,
        queryAsOfDataSlot,
        signal: abortController.signal,
        messagesRef,
      });

      if (artifactRequestIdRef.current !== token) {
        return;
      }

      const finalMessage = createTextMessage({
        id: pendingAssistantMessage.id,
        role: 'assistant',
        text: getArtifactSuccessText(artifact),
        metadata: buildArtifactMetadata(
          artifact,
          artifactIntent.reason,
          queryAsOfDataSlot
        ),
      });
      setMessages(
        replacePendingArtifactMessage({
          currentMessages: messagesRef.current,
          pendingMessageId: pendingAssistantMessage.id,
          fallbackArtifactMessages,
          nextAssistantMessage: finalMessage,
        })
      );
      setError(null);
    } catch (requestError) {
      if (artifactRequestIdRef.current !== token) {
        return;
      }

      const errorText = getArtifactErrorText(artifactKind, requestError);
      const errorMessage = createTextMessage({
        id: pendingAssistantMessage.id,
        role: 'assistant',
        text: errorText,
        metadata: buildArtifactErrorMetadata({
          artifactKind,
          intentReason: artifactIntent.reason,
          queryAsOfDataSlot,
          requestError,
          errorText,
        }),
      });

      setMessages(
        replacePendingArtifactMessage({
          currentMessages: messagesRef.current,
          pendingMessageId: pendingAssistantMessage.id,
          fallbackArtifactMessages,
          nextAssistantMessage: errorMessage,
        })
      );
      setError(errorText);
    } finally {
      stepTimers.forEach(clearTimeout);
      if (artifactRequestIdRef.current === token) {
        artifactRequestIdRef.current = null;
        artifactAbortControllerRef.current = null;
        artifactInFlightRef.current = false;
        setArtifactIsLoading(false);
      }
    }
  })();
}

async function generateChatArtifact({
  artifactIntent,
  query,
  sessionId,
  queryAsOfDataSlot,
  signal,
  messagesRef,
}: {
  artifactIntent: ExecutableChatArtifactIntent;
  query: string;
  sessionId: string;
  queryAsOfDataSlot?: JobDataSlot;
  signal: AbortSignal;
  messagesRef: MutableRefObject<UIMessage[]>;
}): Promise<ChatArtifact> {
  const executor = resolveArtifactExecutor({ kind: artifactIntent.kind });
  if (!executor) {
    throw new Error(`Unsupported artifact kind: ${artifactIntent.kind}`);
  }

  const artifact = await executor({
    artifactIntent,
    query,
    sessionId,
    signal,
    ...(queryAsOfDataSlot && { queryAsOfDataSlot }),
    readPreviousArtifact: (kind) => findLastArtifact(messagesRef.current, kind),
  });
  if (!artifact) {
    throw new Error(
      `Artifact executor returned no artifact: ${artifactIntent.kind}`
    );
  }
  if (artifact.kind !== artifactIntent.kind) {
    throw new Error(
      `Artifact executor returned mismatched artifact kind: ${artifact.kind}`
    );
  }
  return artifact as ChatArtifact;
}

function readArtifactFromMetadata(
  kind: string,
  metadata: unknown
): ChatArtifact | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const record = metadata as Record<string, unknown>;

  const legacyArtifactKeys = [
    'incidentReportArtifact',
    'monitoringAnalysisArtifact',
    'serverMonitoringAnalysisArtifact',
    'serverSnapshotArtifact',
    'opsProcedureArtifact',
  ];
  for (const artifactKey of legacyArtifactKeys) {
    const artifact = record[artifactKey];
    if (
      typeof artifact === 'object' &&
      artifact !== null &&
      (artifact as { kind?: unknown }).kind === kind
    ) {
      return artifact as ChatArtifact;
    }
  }

  const envelopes = Array.isArray(record.artifactEnvelopes)
    ? record.artifactEnvelopes
    : [];
  for (const envelope of envelopes) {
    if (typeof envelope !== 'object' || envelope === null) continue;
    const payload = (envelope as { payload?: unknown }).payload;
    if (
      (envelope as { kind?: unknown }).kind === kind &&
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { kind?: unknown }).kind === kind
    ) {
      return payload as ChatArtifact;
    }
  }

  return undefined;
}

function findLastArtifact(
  messages: UIMessage[],
  kind: string
): ChatArtifact | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const artifact = readArtifactFromMetadata(kind, messages[index]?.metadata);
    if (artifact) return artifact;
  }
  return undefined;
}

function replacePendingArtifactMessage({
  currentMessages,
  pendingMessageId,
  fallbackArtifactMessages,
  nextAssistantMessage,
}: {
  currentMessages: UIMessage[];
  pendingMessageId: string;
  fallbackArtifactMessages: UIMessage[];
  nextAssistantMessage: UIMessage;
}): UIMessage[] {
  return currentMessages.some((message) => message.id === pendingMessageId)
    ? currentMessages.map((message) =>
        message.id === pendingMessageId ? nextAssistantMessage : message
      )
    : [...fallbackArtifactMessages, nextAssistantMessage];
}
