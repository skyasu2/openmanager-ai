/**
 * 🚀 SystemBootSequence Component v2.1 - 호환성 개선
 *
 * 간단하고 안정적인 부팅 시퀀스 관리
 * - 프론트엔드 구성 90% 유지
 * - 복잡한 의존성 제거로 호환성 문제 해결
 * - 자연스러운 로딩 플로우 제공
 */

'use client';

import { useRouter } from 'next/navigation';
import {
  type FC,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { Server } from '@/types/server';
import debug from '@/utils/debug';

interface SystemBootSequenceProps {
  servers: Server[];
  onBootComplete: () => void;
  onServerSpawned?: (server: Server, index: number) => void;
  skipAnimation?: boolean;
  autoStart?: boolean;
  loadingProgress?: number;
  loadingPhase?:
    | 'system-starting'
    | 'data-loading'
    | 'python-warmup'
    | 'completed';
  estimatedTimeRemaining?: number;
  elapsedTime?: number;
}

// 간단한 로딩 단계 정의
const LOADING_STAGES = [
  { name: '시스템 초기화', icon: '⚙️', duration: 1500 },
  { name: '데이터 로딩', icon: '📊', duration: 1200 },
  { name: 'AI 엔진 준비', icon: '🧠', duration: 800 },
  { name: '서버 연결', icon: '🌐', duration: 600 },
  { name: '완료', icon: '✅', duration: 300 },
];

const SystemBootSequence: FC<SystemBootSequenceProps> = memo(
  ({
    servers,
    onBootComplete,
    onServerSpawned: _onServerSpawned,
    skipAnimation = false,
    autoStart = true,
    loadingProgress: _loadingProgress = 0,
    loadingPhase: _loadingPhase = 'system-starting',
    estimatedTimeRemaining: _estimatedTimeRemaining = 0,
    elapsedTime: _elapsedTime = 0,
  }) => {
    const [currentStage, setCurrentStage] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [showEmergencyButton, setShowEmergencyButton] = useState(false);
    const [progress, setProgress] = useState(0);

    const _router = useRouter();

    // 최종 완료 처리 함수
    const handleFinalComplete = useCallback(() => {
      if (!isComplete) {
        debug.log('🎉 SystemBootSequence 완료 처리');
        setIsComplete(true);
        onBootComplete();
      }
    }, [isComplete, onBootComplete]); // onBootComplete 함수 의존성 복구

    // 스킵 조건 체크
    useEffect(() => {
      if (skipAnimation) {
        debug.log('⚡ 애니메이션 스킵 - 즉시 완료');
        handleFinalComplete();
      }
    }, [skipAnimation, handleFinalComplete]); // handleFinalComplete 함수 의존성 복구

    // 자동 진행 로직
    useEffect(() => {
      if (!autoStart || skipAnimation || isComplete) return;

      debug.log('🎬 간단한 부팅 시퀀스 시작');

      let stageTimer: NodeJS.Timeout;
      let progressTimer: NodeJS.Timeout;

      const runStage = (stageIndex: number) => {
        if (stageIndex >= LOADING_STAGES.length) {
          handleFinalComplete();
          return;
        }

        const stage = LOADING_STAGES[stageIndex];
        if (!stage) {
          handleFinalComplete();
          return;
        }

        debug.log(`📊 ${stage.name} 시작`);
        setCurrentStage(stageIndex);

        // 진행률 업데이트
        const startProgress = (stageIndex / LOADING_STAGES.length) * 100;
        const endProgress = ((stageIndex + 1) / LOADING_STAGES.length) * 100;

        let currentProgress = startProgress;
        progressTimer = setInterval(() => {
          currentProgress +=
            (endProgress - startProgress) / (stage.duration / 50);
          if (currentProgress >= endProgress) {
            currentProgress = endProgress;
            clearInterval(progressTimer);
          }
          setProgress(Math.min(currentProgress, 100));
        }, 50);

        // 다음 단계로 진행
        stageTimer = setTimeout(() => {
          clearInterval(progressTimer);
          runStage(stageIndex + 1);
        }, stage.duration);
      };

      runStage(0);

      // 안전장치: 10초 후 강제 완료
      const safetyTimer = setTimeout(() => {
        debug.log('⏰ 안전장치 발동 - 강제 완료');
        handleFinalComplete();
      }, 10000);

      // 15초 후 비상 버튼 표시
      const emergencyTimer = setTimeout(() => {
        setShowEmergencyButton(true);
      }, 15000);

      return () => {
        clearTimeout(stageTimer);
        clearInterval(progressTimer);
        clearTimeout(safetyTimer);
        clearTimeout(emergencyTimer);
      };
    }, [autoStart, skipAnimation, isComplete, handleFinalComplete]); // handleFinalComplete 함수 의존성 복구

    // 키보드 단축키
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (['Enter', ' ', 'Escape'].includes(e.key) && !isComplete) {
          debug.log(`🚀 ${e.key} 키로 즉시 완료`);
          handleFinalComplete();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isComplete, handleFinalComplete]); // handleFinalComplete 함수 의존성 복구

    // 개발자 도구
    useEffect(() => {
      (
        window as { debugSystemBootSequence?: unknown }
      ).debugSystemBootSequence = {
        forceComplete: handleFinalComplete,
        getState: () => ({
          currentStage,
          isComplete,
          progress,
          serversCount: servers?.length || 0,
        }),
      };

      (
        window as { emergencyCompleteBootSequence?: () => void }
      ).emergencyCompleteBootSequence = handleFinalComplete;
    }, [handleFinalComplete, currentStage, isComplete, progress, servers]);

    if (skipAnimation || isComplete) {
      return null;
    }

    const currentStageData = LOADING_STAGES[currentStage] || LOADING_STAGES[0];

    const handleOverlayActivate = () => {
      debug.log('🖱️ 화면 상호작용 - 즉시 완료 처리');
      handleFinalComplete();
    };

    const handleOverlayKeyDown = (
      event: ReactKeyboardEvent<HTMLButtonElement>
    ) => {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        handleOverlayActivate();
      }
    };

    return (
      <button
        type="button"
        tabIndex={0}
        aria-label="로딩 화면을 종료하고 대시보드로 이동"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-green-500 font-mono cursor-pointer"
        onClick={handleOverlayActivate}
        onKeyDown={handleOverlayKeyDown}
      >
        {/* 배경 효과 */}
        <div className="absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        {/* 메인 로딩 화면 */}
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="space-y-8 text-center">
            {/* 현재 단계 아이콘 */}
            <div key={currentStage} className="text-6xl">
              {currentStageData?.icon ?? '🚀'}
            </div>

            {/* 단계 이름 */}
            <h2
              key={`title-${currentStage}`}
              className="text-2xl font-bold text-white"
            >
              {currentStageData?.name ?? '시스템 시작'}
            </h2>

            {/* 진행률 바 */}
            <div className="mx-auto w-80">
              <div className="mb-2 flex justify-between text-sm text-gray-400">
                <span>{Math.round(progress)}%</span>
                <span>
                  {currentStage + 1} / {LOADING_STAGES.length}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-700">
                <div className="h-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500" />
              </div>
            </div>

            {/* 로딩 점들 */}
            <div className="flex justify-center space-x-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 animate-pulse rounded-full bg-white"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1.5s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 비상 완료 버튼 */}
        {showEmergencyButton && (
          <div className="fixed bottom-6 left-1/2 z-10000 -translate-x-1/2 transform">
            <div className="max-w-sm rounded-lg border border-red-500/30 bg-black/90 p-4 text-white shadow-2xl backdrop-blur-sm">
              <div className="space-y-3 text-center">
                <div className="text-sm font-medium text-red-400">
                  🚨 로딩에 문제가 있나요?
                </div>
                <div className="text-xs leading-relaxed text-gray-300">
                  로딩이 오래 걸리고 있습니다. 아래 버튼으로 바로 이동하세요.
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    debug.log('🚀 비상 완료 버튼 클릭');
                    handleFinalComplete();
                  }}
                  className="w-full transform rounded-lg bg-linear-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-medium transition-all duration-200 hover:scale-105 hover:from-blue-700 hover:to-purple-700 active:scale-95"
                >
                  🚀 대시보드로 이동
                </button>
                <div className="text-xs text-gray-400">
                  또는 화면 아무 곳이나 클릭하세요
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용자 안내 */}
        <div className="fixed bottom-4 left-4 max-w-xs rounded-lg border border-white/30 bg-black/50 p-4 text-sm text-white backdrop-blur-lg">
          <div className="space-y-2">
            <div className="font-medium text-cyan-300">💡 빠른 완료 방법</div>
            <div>🖱️ 화면 아무 곳이나 클릭</div>
            <div>⌨️ Enter, Space, ESC 키</div>
            <div>⏱️ 자동 완료: 약 5초</div>
          </div>
        </div>
      </button>
    );
  }
);

SystemBootSequence.displayName = 'SystemBootSequence';

export default SystemBootSequence;
