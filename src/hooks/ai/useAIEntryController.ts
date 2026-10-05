'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import {
  type PendingAIEntryState,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';

export function useAIEntryController() {
  const router = useRouter();
  const isOpen = useAISidebarStore((state) => state.isOpen);
  const setOpen = useAISidebarStore((state) => state.setOpen);
  const openWithPrefill = useAISidebarStore((state) => state.openWithPrefill);
  const queuePendingEntryState = useAISidebarStore(
    (state) => state.queuePendingEntryState
  );

  const openSidebar = useCallback(
    (entry?: PendingAIEntryState) => {
      if (entry) {
        queuePendingEntryState?.({
          ...entry,
          target: entry.target ?? 'sidebar',
        });
      }
      setOpen(true);
    },
    [queuePendingEntryState, setOpen]
  );

  const closeSidebar = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const toggleSidebar = useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  const openFullscreen = useCallback(
    (entry?: PendingAIEntryState) => {
      if (entry) {
        queuePendingEntryState?.({
          ...entry,
          target: 'fullscreen',
        });
      }
      setOpen(false);

      // 아티팩트 focus는 pendingEntryState가 아니라 URL로 넘긴다.
      // pendingEntryState는 one-shot이라 먼저 소비한 인스턴스가 가져간다.
      // /dashboard/ai-assistant를 한 번 방문하면 그 AIWorkspace가 라우트를 떠나도
      // 마운트된 채 남아, 재방문 때 낡은 인스턴스가 entry를 먼저 소비하고
      // 새로 보이는 인스턴스는 null을 받는다(2026-08-16 production 실측).
      // URL 파라미터는 렌더마다 같은 값을 주므로 이 경쟁이 성립하지 않는다.
      const artifactWorkspaceId = entry?.artifactWorkspaceId;
      router.push(
        artifactWorkspaceId
          ? `/dashboard/ai-assistant?artifact=${encodeURIComponent(artifactWorkspaceId)}`
          : '/dashboard/ai-assistant'
      );
    },
    [queuePendingEntryState, router, setOpen]
  );

  return {
    isOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    openWithPrefill,
    openFullscreen,
  };
}
