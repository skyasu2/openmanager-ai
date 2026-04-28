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
      router.push('/dashboard/ai-assistant');
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
