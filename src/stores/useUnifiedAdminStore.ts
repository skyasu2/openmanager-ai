import { create } from 'zustand';
import {
  SYSTEM_AUTO_SHUTDOWN_TIME,
  SYSTEM_WINDOW_SHUTDOWN_REASON,
} from '@/config/system-constants';
import { logger } from '@/lib/logging';

interface UnifiedAdminState {
  // 시스템 상태
  isSystemStarted: boolean;
  systemStartTime: number | null;
  systemShutdownTimer: NodeJS.Timeout | null;
  /** 로컬 타이머 또는 원격 상태로 공용 창이 닫혔는지 */
  systemWindowExpired: boolean;

  // AI 에이전트 상태 (기본 활성화)
  aiAgent: {
    isEnabled: boolean; // 기본 true - 누구나 사용 가능
    state: 'disabled' | 'enabled' | 'processing' | 'idle';
  };

  // UI 상태
  ui: {
    isSettingsPanelOpen: boolean; // 설정 패널 열림 상태
  };

  // 액션 메소드
  startSystem: (remainingMs?: number) => void;
  hydrateSystemWindow: (remainingMs: number) => void;
  stopSystem: () => void;
  getSystemRemainingTime: () => number;
  logout: () => void;
  setSettingsPanelOpen: (isOpen: boolean) => void;
}

function remainingMsToStartTime(remainingMs: number, now = Date.now()): number {
  return now - (SYSTEM_AUTO_SHUTDOWN_TIME - remainingMs);
}

export const useUnifiedAdminStore = create<UnifiedAdminState>()((set, get) => {
  const clearLocalSystemWindow = (expired: boolean) => {
    const currentTimer = get().systemShutdownTimer;
    if (currentTimer) {
      clearTimeout(currentTimer);
    }
    set((state) => ({
      ...state,
      isSystemStarted: false,
      systemStartTime: null,
      systemShutdownTimer: null,
      systemWindowExpired: expired,
    }));
  };

  return {
    isSystemStarted: false,
    systemStartTime: null,
    systemShutdownTimer: null,
    systemWindowExpired: false,

    aiAgent: {
      isEnabled: true,
      state: 'enabled',
    },

    ui: {
      isSettingsPanelOpen: false,
    },

    hydrateSystemWindow: (remainingMs: number) => {
      try {
        const currentTimer = get().systemShutdownTimer;
        if (currentTimer) {
          clearTimeout(currentTimer);
        }

        if (remainingMs <= 0) {
          clearLocalSystemWindow(true);
          return;
        }

        const now = Date.now();
        const shutdownTimer = setTimeout(() => {
          logger.info('⏰ [System] 공용 창 TTL 만료');

          void import('@/services/notifications/BrowserNotificationService')
            .then(({ browserNotificationService }) => {
              browserNotificationService.sendSystemShutdownNotification(
                SYSTEM_WINDOW_SHUTDOWN_REASON
              );
            })
            .catch((error: unknown) => {
              logger.warn('⚠️ [System] 브라우저 종료 알림 전송 실패:', error);
            });

          get().hydrateSystemWindow(0);
        }, remainingMs);

        set((state) => ({
          ...state,
          isSystemStarted: true,
          systemStartTime: remainingMsToStartTime(remainingMs, now),
          systemShutdownTimer: shutdownTimer,
          systemWindowExpired: false,
        }));
      } catch (error) {
        logger.error('❌ [System] 시스템 창 hydrate 실패:', error);
      }
    },

    startSystem: (remainingMs?: number) => {
      get().hydrateSystemWindow(remainingMs ?? SYSTEM_AUTO_SHUTDOWN_TIME);
      logger.info('🚀 [System] 시스템 시작 완료');
      logger.info('🤖 [AI] AI 에이전트는 항상 활성화 상태 유지');
    },

    stopSystem: () => {
      try {
        clearLocalSystemWindow(true);
        logger.info(
          '⏹️ [System] 시스템 정지됨 - AI 에이전트는 계속 활성화 상태'
        );
      } catch (error) {
        logger.error('❌ [System] 시스템 정지 실패:', error);
      }
    },

    getSystemRemainingTime: () => {
      const { systemStartTime } = get();
      if (systemStartTime) {
        const elapsed = Date.now() - systemStartTime;
        return Math.max(0, SYSTEM_AUTO_SHUTDOWN_TIME - elapsed);
      }
      return 0;
    },

    logout: () => {
      try {
        // 로컬 세션만 비운다. 공용 Redis 창을 만료로 표시하면
        // 재로그인 직후 채팅이 막힌다.
        clearLocalSystemWindow(false);
        logger.info('🔐 [System] 전체 로그아웃 완료');
      } catch (error) {
        logger.error('❌ [System] 전체 로그아웃 실패:', error);
      }
    },

    setSettingsPanelOpen: (isOpen: boolean) => {
      set((state) => ({
        ...state,
        ui: {
          ...state.ui,
          isSettingsPanelOpen: isOpen,
        },
      }));
    },
  };
});
