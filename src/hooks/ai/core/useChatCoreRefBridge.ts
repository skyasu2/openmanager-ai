'use client';

import type { UIMessage } from '@ai-sdk/react';
import {
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import type { DeferredMetadataHandlers } from '../useDeferredMessageMetadata';

type SetMessages = (messages: UIMessage[]) => void;

/**
 * useAIChatHybridCallbacks는 useHybridAIQuery 호출 전에 만들어지므로
 * messages/deferredHandlers/setMessages 실값이 아직 없다. 이 훅은 그 콜백들이
 * stale closure 없이 최신 값을 읽을 수 있게 해주는 ref 배선만 전담한다.
 */
export interface ChatCoreRefBridge {
  messagesRef: MutableRefObject<UIMessage[]>;
  setHybridMessagesRef: MutableRefObject<SetMessages>;
  getMessages: () => UIMessage[];
  getDeferredHandlers: () => DeferredMetadataHandlers | null;
  getDeveloperPanelData: () => DeveloperPanelData | null;
  developerPanelData: DeveloperPanelData | null;
  updateDeveloperPanelData: (
    next: SetStateAction<DeveloperPanelData | null>
  ) => void;
  syncRenderState: (input: {
    messages: UIMessage[];
    deferredHandlers: DeferredMetadataHandlers;
  }) => void;
}

export function useChatCoreRefBridge(): ChatCoreRefBridge {
  const messagesRef = useRef<UIMessage[]>([]);
  const deferredHandlersRef = useRef<DeferredMetadataHandlers | null>(null);
  const setHybridMessagesRef = useRef<SetMessages>(() => {});
  const developerPanelDataRef = useRef<DeveloperPanelData | null>(null);
  const [developerPanelData, setDeveloperPanelDataState] =
    useState<DeveloperPanelData | null>(null);

  const getMessages = useCallback(() => messagesRef.current, []);
  const getDeferredHandlers = useCallback(
    () => deferredHandlersRef.current,
    []
  );
  const getDeveloperPanelData = useCallback(
    () => developerPanelDataRef.current,
    []
  );

  const updateDeveloperPanelData = useCallback(
    (next: SetStateAction<DeveloperPanelData | null>) => {
      const resolved =
        typeof next === 'function'
          ? (
              next as (
                prev: DeveloperPanelData | null
              ) => DeveloperPanelData | null
            )(developerPanelDataRef.current)
          : next;
      developerPanelDataRef.current = resolved;
      setDeveloperPanelDataState(resolved);
    },
    []
  );

  // messages/deferredHandlers는 이 훅 바깥(useHybridAIQuery, useDeferredMessageMetadata)에서
  // 나오므로, 호출부가 자신의 useLayoutEffect에서 렌더 후 이 함수로 밀어넣는다.
  const syncRenderState = useCallback(
    (input: {
      messages: UIMessage[];
      deferredHandlers: DeferredMetadataHandlers;
    }) => {
      messagesRef.current = input.messages;
      deferredHandlersRef.current = input.deferredHandlers;
    },
    []
  );

  return useMemo(
    () => ({
      messagesRef,
      setHybridMessagesRef,
      getMessages,
      getDeferredHandlers,
      getDeveloperPanelData,
      developerPanelData,
      updateDeveloperPanelData,
      syncRenderState,
    }),
    [
      developerPanelData,
      getDeferredHandlers,
      getDeveloperPanelData,
      getMessages,
      syncRenderState,
      updateDeveloperPanelData,
    ]
  );
}
