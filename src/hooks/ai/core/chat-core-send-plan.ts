import type { UIMessage } from '@ai-sdk/react';
import type { FileAttachment } from '../useFileAttachments';
import {
  createDebugRoutingMessages,
  createQAAssistantMessages,
  isDebugRoutingPrompt,
  isQAThinkingVisualizerPrompt,
} from './routing-debug-messages';

export const CHAT_CORE_SEND_MESSAGES = {
  artifactBusy:
    '아티팩트 생성이 진행 중입니다. 완료 후 다음 요청을 보내주세요.',
} as const;

export type ChatCoreSendPlan =
  | { kind: 'noop' }
  | { kind: 'session-limit'; messageCount: number }
  | {
      kind: 'queue' | 'qa-thinking' | 'debug-routing' | 'continue';
      effectiveText: string;
      attachments: FileAttachment[] | undefined;
    }
  | { kind: 'artifact-busy' };

export interface ResolveChatCoreSendPlanOptions {
  input: string;
  overrideText?: string;
  attachments?: FileAttachment[];
  disableSessionLimit?: boolean;
  sessionLimitReached: boolean;
  sessionMessageCount: number;
  hybridIsLoading: boolean;
  artifactBusy: boolean;
}

export function resolveChatCoreSendPlan({
  input,
  overrideText,
  attachments,
  disableSessionLimit,
  sessionLimitReached,
  sessionMessageCount,
  hybridIsLoading,
  artifactBusy,
}: ResolveChatCoreSendPlanOptions): ChatCoreSendPlan {
  const textInput = overrideText ?? input;
  const hasText = textInput.trim().length > 0;
  const hasAttachments = (attachments?.length ?? 0) > 0;

  if (!hasText && !hasAttachments) {
    return { kind: 'noop' };
  }

  if (!disableSessionLimit && sessionLimitReached) {
    return { kind: 'session-limit', messageCount: sessionMessageCount };
  }

  const effectiveText = hasText ? textInput : '[이미지/파일 분석 요청]';

  // Preserve user intent while a stream/job is active. The queued query is
  // replayed after the active generation, even if an artifact request is also busy.
  if (hybridIsLoading) {
    return { kind: 'queue', effectiveText, attachments };
  }

  if (artifactBusy) {
    return { kind: 'artifact-busy' };
  }

  if (isQAThinkingVisualizerPrompt(effectiveText)) {
    return { kind: 'qa-thinking', effectiveText, attachments };
  }

  if (isDebugRoutingPrompt(effectiveText)) {
    return { kind: 'debug-routing', effectiveText, attachments };
  }

  return { kind: 'continue', effectiveText, attachments };
}

export interface ExecuteLocalChatCoreSendPlanContext {
  messages: UIMessage[];
  addToQueue: (
    query: string,
    attachments: FileAttachment[] | undefined
  ) => void;
  setInput: (value: string) => void;
  setError: (value: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  resetRequestState: (
    query: string,
    attachments?: FileAttachment[] | null,
    pendingQuery?: string
  ) => void;
  onSessionLimitReached: (messageCount: number) => void;
}

export type ExecuteLocalChatCoreSendPlanResult =
  | { handled: true }
  | {
      handled: false;
      effectiveText: string;
      attachments: FileAttachment[] | undefined;
    };

export function executeLocalChatCoreSendPlan(
  plan: ChatCoreSendPlan,
  context: ExecuteLocalChatCoreSendPlanContext
): ExecuteLocalChatCoreSendPlanResult {
  switch (plan.kind) {
    case 'noop':
      return { handled: true };
    case 'session-limit':
      context.onSessionLimitReached(plan.messageCount);
      return { handled: true };
    case 'queue':
      context.addToQueue(plan.effectiveText, plan.attachments);
      context.setInput('');
      return { handled: true };
    case 'artifact-busy':
      context.setError(CHAT_CORE_SEND_MESSAGES.artifactBusy);
      return { handled: true };
    case 'qa-thinking': {
      context.resetRequestState(plan.effectiveText, plan.attachments || null);
      const [userMessage, assistantMessage] = createQAAssistantMessages(
        plan.effectiveText
      );
      context.setMessages([...context.messages, userMessage, assistantMessage]);
      return { handled: true };
    }
    case 'debug-routing': {
      context.resetRequestState(plan.effectiveText, plan.attachments || null);
      const [userMessage, assistantMessage] = createDebugRoutingMessages(
        plan.effectiveText
      );
      context.setMessages([...context.messages, userMessage, assistantMessage]);
      return { handled: true };
    }
    case 'continue':
      return {
        handled: false,
        effectiveText: plan.effectiveText,
        attachments: plan.attachments,
      };
  }
}
