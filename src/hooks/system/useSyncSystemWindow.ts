'use client';

import { useEffect } from 'react';
import { SYSTEM_AUTO_SHUTDOWN_TIME } from '@/config/system-constants';
import type { SystemStatus } from '@/hooks/system/useSystemStatus';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

/**
 * /api/system 의 Redis TTL을 로컬 카운트다운 SSOT로 맞춘다.
 * isRunning 토글뿐 아니라 remainingMs 갱신에도 hydrate 한다.
 */
export function useSyncSystemWindow(status: SystemStatus | null) {
  const hydrateSystemWindow = useUnifiedAdminStore(
    (state) => state.hydrateSystemWindow
  );
  const stopSystem = useUnifiedAdminStore((state) => state.stopSystem);

  const isRunning = status?.isRunning;
  const remainingMs = status?.remainingMs;

  useEffect(() => {
    if (isRunning == null) return;

    if (!isRunning) {
      stopSystem();
      return;
    }

    if (typeof remainingMs === 'number') {
      hydrateSystemWindow(remainingMs);
      return;
    }

    // TTL 조회 실패(null)를 전체 창으로 덮어쓰면 실제 만료보다
    // 카운트다운이 길어져 409가 다시 갑자기 보인다.
    if (!useUnifiedAdminStore.getState().isSystemStarted) {
      hydrateSystemWindow(SYSTEM_AUTO_SHUTDOWN_TIME);
    }
  }, [hydrateSystemWindow, isRunning, remainingMs, stopSystem]);
}
