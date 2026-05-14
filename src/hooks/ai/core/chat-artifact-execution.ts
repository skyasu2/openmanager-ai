import type { UIMessage } from '@ai-sdk/react';
import type { MutableRefObject } from 'react';
import { executeChatArtifact } from '@/lib/ai/chat-artifacts/artifact-execution';
import type {
  ChatArtifactIntent,
  ChatArtifactIntentReason,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import {
  generateOpsProcedureArtifact,
  patchOpsProcedureArtifactFromQuery,
} from '@/lib/ai/chat-artifacts/ops-procedure-artifact';
import { generateServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/server-snapshot-artifact';
import type {
  ChatArtifact,
  OpsProcedureArtifact,
} from '@/lib/ai/chat-artifacts/types';
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
  switch (artifactIntent.kind) {
    case 'incident-report':
      return executeChatArtifact({
        kind: 'incident-report',
        query,
        sessionId,
        queryAsOfDataSlot,
        signal,
      });
    case 'server-snapshot':
      return generateServerSnapshotArtifact({
        query,
        sessionId,
        queryAsOfDataSlot,
        signal,
      });
    case 'ops-procedure':
      return generateOpsProcedureArtifactFromIntent({
        query,
        sessionId,
        queryAsOfDataSlot,
        signal,
        intentReason: artifactIntent.reason,
        messagesRef,
      });
    case 'monitoring-analysis':
      return executeChatArtifact({
        kind: 'monitoring-analysis',
        query,
        sessionId,
        queryAsOfDataSlot,
        signal,
      });
    case 'server-monitoring-analysis':
      return executeChatArtifact({
        kind: 'server-monitoring-analysis',
        query,
        sessionId,
        serverId: artifactIntent.serverId,
        serverName: artifactIntent.serverName ?? artifactIntent.serverId,
        queryAsOfDataSlot,
        signal,
      });
  }
}

async function generateOpsProcedureArtifactFromIntent({
  query,
  sessionId,
  queryAsOfDataSlot,
  signal,
  intentReason,
  messagesRef,
}: {
  query: string;
  sessionId: string;
  queryAsOfDataSlot?: JobDataSlot;
  signal: AbortSignal;
  intentReason: ChatArtifactIntentReason;
  messagesRef: MutableRefObject<UIMessage[]>;
}): Promise<OpsProcedureArtifact> {
  if (intentReason !== 'ops_procedure_followup_edit_pattern') {
    return generateOpsProcedureArtifact({
      query,
      sessionId,
      queryAsOfDataSlot,
      signal,
    });
  }

  const existingArtifact =
    findLastOpsProcedureArtifact(messagesRef.current) ??
    (await generateOpsProcedureArtifact({
      query,
      sessionId,
      queryAsOfDataSlot,
      signal,
    }));

  return patchOpsProcedureArtifactFromQuery(existingArtifact, query);
}

function readOpsProcedureArtifactFromMetadata(
  metadata: unknown
): OpsProcedureArtifact | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const record = metadata as Record<string, unknown>;

  if (
    typeof record.opsProcedureArtifact === 'object' &&
    record.opsProcedureArtifact !== null &&
    (record.opsProcedureArtifact as { kind?: unknown }).kind === 'ops-procedure'
  ) {
    return record.opsProcedureArtifact as OpsProcedureArtifact;
  }

  const envelopes = Array.isArray(record.artifactEnvelopes)
    ? record.artifactEnvelopes
    : [];
  for (const envelope of envelopes) {
    if (typeof envelope !== 'object' || envelope === null) continue;
    const payload = (envelope as { payload?: unknown }).payload;
    if (
      (envelope as { kind?: unknown }).kind === 'ops-procedure' &&
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { kind?: unknown }).kind === 'ops-procedure'
    ) {
      return payload as OpsProcedureArtifact;
    }
  }

  return undefined;
}

function findLastOpsProcedureArtifact(
  messages: UIMessage[]
): OpsProcedureArtifact | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const artifact = readOpsProcedureArtifactFromMetadata(
      messages[index]?.metadata
    );
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
