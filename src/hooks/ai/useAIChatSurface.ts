'use client';

import { useCallback, useState } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';
import {
  type AIEntryTarget,
  type PendingAIEntryState,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';
import type { AnalysisMode } from '@/types/ai/analysis-mode';

export interface AIChatSurfaceState {
  selectedFunction: AIAssistantFunction;
  setSelectedFunction: (fn: AIAssistantFunction) => void;
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  ragEnabled: boolean;
  toggleRAG: () => void;
  analysisMode: AnalysisMode;
  selectAnalysisMode: (mode: AnalysisMode) => void;
  pendingEntryState: PendingAIEntryState | null;
  consumePendingEntryState: (
    target?: AIEntryTarget
  ) => PendingAIEntryState | null;
  pendingPrefillMessage: string | null;
  consumePendingPrefillMessage: () => void;
}

/**
 * AISidebarV4와 AIWorkspace의 공통 store 구독과 selectedFunction 상태를 번들링합니다.
 *
 * 두 surface 모두 동일한 useAISidebarStore 슬라이스와 selectedFunction 로컬 상태가
 * 필요하므로 이 훅으로 중복을 제거합니다.
 */
export function useAIChatSurface(
  initialFunction: AIAssistantFunction = 'chat'
): AIChatSurfaceState {
  const [selectedFunction, setSelectedFunction] =
    useState<AIAssistantFunction>(initialFunction);

  const webSearchEnabled = useAISidebarStore((s) => s.webSearchEnabled);
  const setWebSearchEnabled = useAISidebarStore((s) => s.setWebSearchEnabled);
  const ragEnabled = useAISidebarStore((s) => s.ragEnabled);
  const setRagEnabled = useAISidebarStore((s) => s.setRagEnabled);
  const analysisMode = useAISidebarStore((s) => s.analysisMode);
  const setAnalysisMode = useAISidebarStore((s) => s.setAnalysisMode);
  const pendingEntryState = useAISidebarStore((s) => s.pendingEntryState);
  const consumePendingEntryState = useAISidebarStore(
    (s) => s.consumePendingEntryState
  );
  const pendingPrefillMessage = useAISidebarStore(
    (s) => s.pendingPrefillMessage
  );
  const consumePendingPrefillMessage = useAISidebarStore(
    (s) => s.consumePendingPrefillMessage
  );

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
  }, [setWebSearchEnabled]);

  const toggleRAG = useCallback(() => {
    setRagEnabled((prev) => !prev);
  }, [setRagEnabled]);

  const selectAnalysisMode = useCallback(
    (mode: AnalysisMode) => {
      setAnalysisMode(mode);
    },
    [setAnalysisMode]
  );

  return {
    selectedFunction,
    setSelectedFunction,
    webSearchEnabled,
    toggleWebSearch,
    ragEnabled,
    toggleRAG,
    analysisMode,
    selectAnalysisMode,
    pendingEntryState,
    consumePendingEntryState,
    pendingPrefillMessage,
    consumePendingPrefillMessage,
  };
}
