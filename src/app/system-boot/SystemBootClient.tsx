'use client';

import {
  Brain,
  CheckCircle,
  Cpu,
  Database,
  Loader2,
  type LucideIcon,
  Monitor,
  Server as ServerIcon,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { clearChatHistory } from '@/hooks/ai/utils/chat-history-storage';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import debug from '@/utils/debug';
import { createTrackedTimeoutScheduler } from './timeout-scheduler';
import { BootProgressBar } from './components/BootProgressBar';
import { SmoothLoadingSpinner } from './components/SmoothLoadingSpinner';

// 로딩 단계 정의 (정적 데이터 - 컴포넌트 외부)
const BOOT_STAGES = [
  {
    name: '시스템 초기화',
    delay: 500,
    icon: Loader2,
    description: '시스템 환경 설정을 확인하고 있습니다...',
  },
  {
    name: '서버 연결 확인',
    delay: 1200,
    icon: ServerIcon,
    description: 'MCP 서버와 연결을 설정하고 있습니다...',
  },
  {
    name: '데이터베이스 연결',
    delay: 1900,
    icon: Database,
    description: 'Supabase 데이터베이스에 연결하고 있습니다...',
  },
  {
    name: 'AI 엔진 로딩',
    delay: 2600,
    icon: Brain,
    description: 'AI 분석 엔진을 초기화하고 있습니다...',
  },
  {
    name: '서버 데이터 동기화',
    delay: 3300,
    icon: Cpu,
    description: '실시간 서버 메트릭을 동기화하고 있습니다...',
  },
  {
    name: '대시보드 준비',
    delay: 4000,
    icon: Monitor,
    description: '모니터링 대시보드를 준비하고 있습니다...',
  },
  {
    name: '시스템 시작 완료',
    delay: 4700,
    icon: CheckCircle,
    description: 'OpenManager가 준비되었습니다!',
  },
] as const;

const STAGE_FADE_DELAY_MS = 150;
const BOOT_COMPLETE_DELAY_MS = 500;
const DASHBOARD_REDIRECT_DELAY_MS = 1000;

export default function SystemBootClient() {
  const router = useRouter();
  const { isSystemStarted } = useUnifiedAdminStore();
  const [bootState, setBootState] = useState<'running' | 'completed'>(
    'running'
  );
  const [currentStage, setCurrentStage] = useState<string>('시스템 초기화');
  const [progress, setProgress] = useState(0);
  const [currentIcon, setCurrentIcon] = useState<LucideIcon>(Loader2);
  const [isClient, setIsClient] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutScheduler = useMemo(() => createTrackedTimeoutScheduler(), []);

  const clearScheduledTimeouts = useCallback(() => {
    timeoutScheduler.clearAll();
  }, [timeoutScheduler]);

  const scheduleTimeout = useCallback(
    (callback: () => void, delay: number) => {
      return timeoutScheduler.schedule(callback, delay);
    },
    [timeoutScheduler]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 3-A: 시스템 이미 가동 중이면 즉시 대시보드로 이동
  useEffect(() => {
    if (isSystemStarted) {
      router.replace('/dashboard');
    }
  }, [isSystemStarted, router]);

  // 부팅 완료 - 부드러운 전환 후 대시보드로 이동
  const handleBootComplete = useCallback(() => {
    debug.log('🎉 시스템 로딩 완료 - 대시보드로 이동');
    setBootState('completed');

    // 완료 상태 표시
    setCurrentStage('시스템 준비 완료');
    setCurrentIcon(CheckCircle);
    setProgress(100);
    setIsTransitioning(false);

    // 부드러운 전환을 위해 잠시 대기 후 이동
    scheduleTimeout(() => {
      router.push('/dashboard');
    }, DASHBOARD_REDIRECT_DELAY_MS);
  }, [router, scheduleTimeout]);

  // 🚀 순수 타이머 기반 로딩 로직 (시간 벌기 용도)
  useEffect(() => {
    if (!isClient) return;
    // 시스템 이미 가동 중이면 부팅 로직 스킵 (채팅 기록 보호)
    if (isSystemStarted) return;

    debug.log('🚀 OpenManager 시스템 로딩 시작');

    // 🧹 이전 세션 대화 기록 초기화 (새 세션 시작)
    clearChatHistory();
    useAISidebarStore.getState().clearMessages();
    debug.log('🧹 이전 대화 기록 초기화 완료');

    // 🚀 AI 엔진 웜업 요청 (중복 요청 자동 방지)
    void triggerAIWarmup('system-boot');

    // 로딩 애니메이션 실행 (순수 타이머 방식)
    BOOT_STAGES.forEach(({ name, delay, icon }, index) => {
      scheduleTimeout(() => {
        // 페이드 트랜지션 시작
        setIsTransitioning(true);

        scheduleTimeout(() => {
          setCurrentStage(name);
          setCurrentIcon(icon);
          const newProgress = ((index + 1) / BOOT_STAGES.length) * 100;
          setProgress(newProgress);

          // 페이드 트랜지션 종료
          scheduleTimeout(() => {
            setIsTransitioning(false);
          }, STAGE_FADE_DELAY_MS);

          // 마지막 단계 완료 → 대시보드로 이동
          if (index === BOOT_STAGES.length - 1) {
            debug.log('🎬 로딩 애니메이션 완료');
            scheduleTimeout(() => handleBootComplete(), BOOT_COMPLETE_DELAY_MS);
          }
        }, STAGE_FADE_DELAY_MS);
      }, delay);
    });

    // 컴포넌트 언마운트 시 정리
    return () => {
      clearScheduledTimeouts();
    };
  }, [
    clearScheduledTimeouts,
    handleBootComplete,
    isClient,
    isSystemStarted,
    scheduleTimeout,
  ]);

  const currentStageData = BOOT_STAGES.find((s) => s.name === currentStage) ||
    BOOT_STAGES[0] || {
      name: '초기화 중',
      delay: 500,
      icon: Loader2,
      description: '시스템을 초기화하고 있습니다...',
    };
  const CurrentIconComponent = currentIcon as FC<{ className?: string }>;

  // 시스템 이미 가동 중이면 렌더링 스킵 (UI 플래시 방지)
  if (isSystemStarted) {
    return null;
  }

  // 클라이언트 렌더링이 준비되지 않았으면 로딩 표시
  if (!isClient) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
      >
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
    >
      {/* 첫페이지와 동일한 웨이브 파티클 배경 효과 */}
      <div className="wave-particles"></div>

      {/* 부드러운 배경 오버레이 */}
      <div className="absolute inset-0">
        <div className="animate-pulse absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="animate-pulse absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="animate-pulse absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-pink-500/5 blur-3xl" />
      </div>

      {/* 메인 로딩 화면 */}
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <div className="max-w-2xl px-8 text-center">
          {/* 부드러운 로딩 스피너 */}
          <SmoothLoadingSpinner />

          {/* 제품 브랜드 */}
          <h1 className="mb-4 text-5xl font-bold">
            <span className="bg-linear-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              OpenManager
            </span>
          </h1>

          {/* 버전 정보 */}
          <p className="mb-8 text-xl font-light text-white/80">
            AI 기반 서버 모니터링
          </p>

          {/* 🎯 부드러운 아이콘 교체 시스템 - 현재 단계 아이콘 */}
          <div className="relative mx-auto mb-6 h-20 w-20">
            <div className="absolute inset-0">
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 via-purple-600 to-pink-500 text-white shadow-2xl">
                {/* 아이콘 - 페이드 트랜지션 추가 */}
                <div
                  className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
                >
                  <CurrentIconComponent className="h-10 w-10" />
                </div>
              </div>
            </div>
          </div>

          {/* 현재 단계명 - 페이드 트랜지션 추가 */}
          <h2
            className={`mb-4 text-2xl font-semibold text-white transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            {currentStage}
          </h2>

          {/* 단계 설명 - 페이드 트랜지션 추가 */}
          <p
            className={`mb-8 font-light text-white/70 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            {currentStageData.description}
          </p>

          {/* 부드러운 진행률 바 */}
          <BootProgressBar progress={progress} />

          {/* 시스템 상태 아이콘들 */}
          <div className="mb-8 flex justify-center gap-6">
            {[ServerIcon, Database, Brain, Cpu, Zap, CheckCircle].map(
              (Icon, index) => {
                const isActive = index < Math.floor((progress / 100) * 6);
                const isCurrentStep =
                  index === Math.floor((progress / 100) * 6) - 1;

                return (
                  <div key={index} className="relative">
                    {/* 메인 아이콘 컨테이너 */}
                    <div
                      className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl transition-all duration-300 ${
                        isActive
                          ? 'bg-linear-to-br from-blue-500 via-purple-600 to-pink-500 text-white shadow-lg'
                          : 'border border-white/20 bg-white/10 text-white/40'
                      }`}
                    >
                      {/* 아이콘 */}
                      <div
                        className={`h-6 w-6 ${isActive ? 'text-white' : 'text-white/40'}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>

                    {/* 글로우 효과 */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-xl bg-linear-to-br from-blue-500/20 via-purple-600/20 to-pink-500/20 blur-lg" />
                    )}

                    {/* 현재 단계 펄스 효과 */}
                    {isCurrentStep && (
                      <div className="animate-pulse absolute inset-0 rounded-xl border-2 border-white/50" />
                    )}

                    {/* 완료 체크 마크 */}
                    {isActive &&
                      index < Math.floor((progress / 100) * 6) - 1 && (
                        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}

                    {/* 연결선 */}
                    {index < 5 && (
                      <div className="absolute -right-3 top-1/2 h-0.5 w-6 origin-left bg-linear-to-r from-white/30 to-transparent" />
                    )}
                  </div>
                );
              }
            )}
          </div>

          {/* 하단 상태 메시지 */}
          <div className="text-sm font-light text-white/50">
            <p>
              잠시만 기다려주세요. 최고의 모니터링 경험을 준비하고 있습니다.
            </p>
            {bootState === 'completed' && (
              <p className="animate-pulse mt-2 text-green-400">
                🎉 시스템 준비 완료! 대시보드로 이동 중...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 첫페이지와 동일한 스타일 적용을 위한 CSS */}
      <style jsx>{`
        .wave-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
          pointer-events: none;
        }

        .wave-particles::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background:
            radial-gradient(
              circle at 20% 80%,
              rgba(59, 130, 246, 0.1) 0%,
              transparent 50%
            ),
            radial-gradient(
              circle at 80% 20%,
              rgba(139, 92, 246, 0.1) 0%,
              transparent 50%
            ),
            radial-gradient(
              circle at 40% 40%,
              rgba(236, 72, 153, 0.1) 0%,
              transparent 50%
            );
          animation: wave-float 20s ease-in-out infinite;
        }

        @keyframes wave-float {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }
      `}</style>
    </div>
  );
}
