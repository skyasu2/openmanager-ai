'use client';

import { useCallback, useState } from 'react';
import { useSystemStatus } from '@/hooks/system/useSystemStatus';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

/**
 * 채팅 전송을 공용 창 상태에 맞춘다.
 * 상태 조회 전에는 fail-open(서버 409가 백스톱).
 */
export function useSystemWindowChatGate() {
  const expired = useUnifiedAdminStore((state) => state.systemWindowExpired);
  const { status, startSystem } = useSystemStatus({ enabled: true });
  const [isStartingSystem, setIsStartingSystem] = useState(false);

  const systemWindowClosed = expired || status?.isRunning === false;

  const onStartSystem = useCallback(async () => {
    setIsStartingSystem(true);
    try {
      await startSystem();
    } finally {
      setIsStartingSystem(false);
    }
  }, [startSystem]);

  return {
    systemWindowClosed,
    isStartingSystem,
    onStartSystem,
  };
}
