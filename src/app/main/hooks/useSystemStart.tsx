/**
 * 🚀 시스템 시작 로직 Hook
 *
 * 메인 페이지에서 추출된 시스템 시작 관련 로직
 * - 카운트다운 관리
 * - 시작/정지 토글
 * - 버튼 상태 계산
 */

import { BarChart3, Loader2, Play, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { logger } from '@/lib/logging';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import debug from '@/utils/debug';
import { debugWithEnv } from '@/utils/vercel-env-utils';

const SYSTEM_START_COUNTDOWN_SECONDS = 5; // Cloud Run cold start 대기 (5-10초)
const COUNTDOWN_INTERVAL_MS = 1000;
const SYSTEM_BOOT_PATH = '/system-boot';
const LOGIN_REDIRECT_URL = `/login?redirectTo=${encodeURIComponent(
  SYSTEM_BOOT_PATH
)}`;

interface UseSystemStartOptions {
  isAuthenticated: boolean;
  isGitHubUser: boolean;
  authLoading: boolean;
  isMounted: boolean;
}

interface StatusInfo {
  color: string;
  message: string;
  showEscHint: boolean;
}

interface ButtonConfig {
  text: string;
  icon: React.ReactNode;
  className: string;
  disabled: boolean;
}

export function useSystemStart(options: UseSystemStartOptions) {
  const { isAuthenticated, isGitHubUser, authLoading, isMounted } = options;

  const router = useRouter();
  const pathname = usePathname();

  const { isSystemStarted, startSystem } = useUnifiedAdminStore(
    useShallow((s) => ({
      isSystemStarted: s.isSystemStarted,
      startSystem: s.startSystem,
    }))
  );

  const {
    status: multiUserStatus,
    isLoading: statusLoading,
    startSystem: startMultiUserSystem,
  } = useSystemStatus();

  const [systemStartCountdown, setSystemStartCountdown] = useState(0);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isSystemStarting, setIsSystemStarting] = useState(false);

  // 네비게이션 펜딩 상태 (렌더링 중 router.push 방지)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );

  // 펜딩 네비게이션 처리 (렌더링 외부에서 실행)
  useEffect(() => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [pendingNavigation, router]);

  // 게스트 제한 모달 상태 (alert 대체)
  const [showGuestRestriction, setShowGuestRestriction] = useState(false);

  // 🔧 카운트다운 취소 함수 (setState 배칭 최적화)
  const cancelCountdown = useCallback(() => {
    if (countdownTimer) clearInterval(countdownTimer);
    // React 18+ 자동 배칭: 동일 이벤트 핸들러 내 setState는 배칭됨
    setCountdownTimer(null);
    setSystemStartCountdown(0);
    setIsSystemStarting(false);
  }, [countdownTimer]);

  // ESC 키로 카운트다운 취소
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && systemStartCountdown > 0) {
        cancelCountdown();
      }
    };
    if (systemStartCountdown > 0) {
      window.addEventListener('keydown', handleEscKey);
      return () => window.removeEventListener('keydown', handleEscKey);
    }
    return undefined;
  }, [systemStartCountdown, cancelCountdown]);

  // 타이머 클린업
  useEffect(() => {
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [countdownTimer]);

  // 시스템 시작 상태 동기화
  useEffect(() => {
    if (!multiUserStatus) return;
    const currentStarting = multiUserStatus.isStarting || false;
    if (currentStarting !== isSystemStarting) {
      debug.log(
        debugWithEnv(
          `🔄 시스템 시작 상태 업데이트: ${isSystemStarting} → ${currentStarting}`
        )
      );
      setIsSystemStarting(currentStarting);
    }
  }, [multiUserStatus, isSystemStarting]);

  // 상태 정보 계산
  const statusInfo: StatusInfo = useMemo(() => {
    if (systemStartCountdown > 0) {
      return {
        color: 'text-orange-300',
        message: '⚠️ 시작 예정 - 취소하려면 클릭',
        showEscHint: true,
      };
    }
    if (isSystemStarting) {
      return {
        color: 'text-purple-300',
        message: '🚀 시스템 부팅 중...',
        showEscHint: false,
      };
    }
    if (multiUserStatus?.isRunning || isSystemStarted) {
      let shutdownTime: string | null = null;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          shutdownTime = localStorage.getItem('system_auto_shutdown');
        }
      } catch {
        // localStorage가 비활성화된 환경에서 무시
      }
      let message = '✅ 시스템 가동 중 - 대시보드로 이동';
      if (shutdownTime) {
        const timeLeft = Math.max(
          0,
          Math.floor((parseInt(shutdownTime, 10) - Date.now()) / 60000)
        );
        message = `✅ 시스템 가동 중 (${timeLeft}분 후 자동 종료)`;
      }
      return { color: 'text-green-300', message, showEscHint: false };
    }
    return {
      color: 'text-white',
      message: '클릭하여 시작하기',
      showEscHint: false,
    };
  }, [
    systemStartCountdown,
    isSystemStarting,
    multiUserStatus?.isRunning,
    isSystemStarted,
  ]);

  // 시스템 토글 핸들러
  const handleSystemToggle = useCallback(() => {
    const isActuallyLoading =
      statusLoading ||
      isSystemStarting ||
      (authLoading && !isAuthenticated && !isGitHubUser);

    if (isActuallyLoading) {
      logger.info('🚫 시스템 토글 차단:', {
        statusLoading,
        isSystemStarting,
        authLoading,
        isAuthenticated,
        isGitHubUser,
      });
      return;
    }

    // 비로그인 상태에서는 카운트다운 없이 즉시 로그인 화면으로 이동
    if (!isAuthenticated) {
      if (systemStartCountdown > 0) {
        cancelCountdown();
      }

      logger.info('🔐 비로그인 사용자 - 로그인 페이지로 즉시 이동');
      if (!pathname.startsWith('/login')) {
        setPendingNavigation(LOGIN_REDIRECT_URL);
      }
      return;
    }

    logger.info('✅ 시스템 토글 실행 - GitHub 사용자:', isGitHubUser);

    // 카운트다운 중이면 취소 (최적화된 함수 사용)
    if (systemStartCountdown > 0) {
      cancelCountdown();
      return;
    }

    // 이미 실행 중이면 대시보드로 이동
    if (multiUserStatus?.isRunning || isSystemStarted) {
      if (pathname !== '/dashboard') router.push('/dashboard');
    } else {
      // 카운트다운 시작
      setSystemStartCountdown(SYSTEM_START_COUNTDOWN_SECONDS);
      setIsSystemStarting(false);
      // 🚀 AI 엔진 웜업 (중복 요청 자동 방지)
      void triggerAIWarmup('system-start-button');
      const timer = setInterval(() => {
        setSystemStartCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            debug.log('🚀 카운트다운 완료 - 로딩 페이지로 이동');
            void (async () => {
              try {
                await startMultiUserSystem();
                await startSystem();
              } catch (error) {
                debug.error('❌ 시스템 시작 실패:', error);
                setIsSystemStarting(false);
              }
            })();
            // 렌더링 외부에서 네비게이션 실행 (React 규칙 준수)
            setPendingNavigation(SYSTEM_BOOT_PATH);
            return 0;
          }
          return prev - 1;
        });
      }, COUNTDOWN_INTERVAL_MS);
      setCountdownTimer(timer);
    }
  }, [
    isSystemStarting,
    systemStartCountdown,
    multiUserStatus?.isRunning,
    isSystemStarted,
    pathname,
    isAuthenticated,
    isGitHubUser,
    authLoading,
    statusLoading,
    cancelCountdown, // 🔧 countdownTimer → cancelCountdown으로 최적화
    router,
    startMultiUserSystem,
    startSystem,
  ]);

  // 버튼 설정 계산
  const buttonConfig: ButtonConfig = useMemo(() => {
    const getIcon = (
      IconComponent: React.ComponentType<{ className?: string }>,
      className: string
    ) => (isMounted ? <IconComponent className={className} /> : null);

    if (systemStartCountdown > 0) {
      return {
        text: `시작 취소 (${systemStartCountdown}초)`,
        icon: getIcon(X, 'h-5 w-5'),
        className:
          'bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-red-400/50 relative overflow-hidden',
        disabled: false,
      };
    }

    if (isSystemStarting) {
      return {
        text: '시스템 시작 중...',
        icon: getIcon(Loader2, 'h-5 w-5 animate-spin'),
        className:
          'bg-linear-to-r from-purple-500 to-blue-600 text-white border-purple-400/50 cursor-not-allowed',
        disabled: true,
      };
    }

    const isActuallyLoading =
      statusLoading ||
      isSystemStarting ||
      (authLoading && !isAuthenticated && !isGitHubUser);
    if (isActuallyLoading) {
      return {
        text: '시스템 초기화 중...',
        icon: getIcon(Loader2, 'h-5 w-5 animate-spin'),
        className:
          'bg-gray-500 text-white border-gray-400/50 cursor-not-allowed',
        disabled: true,
      };
    }

    if (multiUserStatus?.isRunning || isSystemStarted) {
      return {
        text: `📊 대시보드 이동 (사용자: ${multiUserStatus?.userCount || 0}명)`,
        icon: getIcon(BarChart3, 'h-5 w-5'),
        className:
          'bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-green-400/50',
        disabled: false,
      };
    }

    return {
      text: '🚀 시스템 시작',
      icon: getIcon(Play, 'h-5 w-5'),
      className:
        'bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-blue-400/50',
      disabled: false,
    };
  }, [
    isMounted,
    systemStartCountdown,
    isSystemStarting,
    authLoading,
    isAuthenticated,
    isGitHubUser,
    statusLoading,
    multiUserStatus?.isRunning,
    multiUserStatus?.userCount,
    isSystemStarted,
  ]);

  return {
    // 상태
    systemStartCountdown,
    isSystemStarting,
    isSystemStarted,
    multiUserStatus,
    statusLoading,

    // 게스트 제한 모달 상태
    showGuestRestriction,
    dismissGuestRestriction: () => setShowGuestRestriction(false),

    // 계산된 값
    statusInfo,
    buttonConfig,

    // 액션
    handleSystemToggle,
    navigateToDashboard: () => {
      // 대시보드 직접 이동 시에도 웜업 시도 (중복 요청 자동 방지)
      void triggerAIWarmup('navigate-dashboard');
      router.push('/dashboard');
    },
  };
}

export type { StatusInfo, ButtonConfig };
