/**
 * 🎬 useSequentialLoadingTime Hook v2.1 - 호환성 개선
 *
 * 순차적 로딩 단계를 시뮬레이션하는 훅
 * - 프론트엔드 구성 90% 유지
 * - 실제 시스템과의 호환성 문제 해결
 * - 자연스러운 단계별 진행
 *
 * @param onComplete - 완료 시 호출될 콜백 함수
 * @param skipCondition - 스킵 조건
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logging';

interface UseSequentialLoadingTimeProps {
  onComplete?: () => void;
  skipCondition?: boolean;
}

export const useSequentialLoadingTime = ({
  onComplete,
  skipCondition = false,
}: UseSequentialLoadingTimeProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // 로딩 단계 정의 (기존 구성 유지)
  const phases = useMemo(
    () => [
      {
        name: 'system-init',
        duration: 500,
        description: '시스템 초기화 중...',
      },
      { name: 'data-load', duration: 800, description: '데이터 로딩 중...' },
      // ai-warmup 제거됨 - Google Cloud VM 24시간 동작
      { name: 'ui-render', duration: 400, description: 'UI 렌더링 중...' },
      { name: 'final-check', duration: 300, description: '최종 확인 중...' },
    ],
    []
  );

  // 완료 처리 함수
  const handleComplete = useCallback(() => {
    if (!isCompleted) {
      logger.info('🎯 useSequentialLoadingTime 완료');
      setIsCompleted(true);
      setIsLoading(false);
      setProgress(100);
      setCurrentStage(phases.length);

      setTimeout(() => {
        try {
          onComplete?.();
        } catch (error) {
          logger.error('❌ onComplete 콜백 에러:', error);
        }
      }, 100);
    }
  }, [isCompleted, onComplete, phases.length]);

  // 스킵 조건 처리
  useEffect(() => {
    if (skipCondition && !isCompleted) {
      logger.info('⚡ 순차 로딩 스킵');
      handleComplete();
      return;
    }
  }, [skipCondition, isCompleted, handleComplete]);

  // 키보드 스킵 기능
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !isCompleted) {
        logger.info(`🚀 ${e.key} 키로 순차 로딩 스킵`);
        handleComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleComplete, isCompleted]);

  // 순차적 로딩 로직
  useEffect(() => {
    if (skipCondition || isCompleted) return;

    logger.info('🎬 순차적 로딩 시작');

    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };

    const runStage = (stageIndex: number) => {
      if (isCleanedUp || isCompleted || stageIndex >= phases.length) {
        handleComplete();
        return;
      }

      const stage = phases[stageIndex];
      if (!stage) {
        handleComplete();
        return;
      }

      logger.info(`📊 ${stage.name} 단계 시작: ${stage.description}`);
      setCurrentStage(stageIndex);

      const startTime = Date.now();
      const baseProgress = (stageIndex / phases.length) * 100;
      const stageProgressRange = 100 / phases.length;

      // 단계별 진행률 업데이트
      intervalId = setInterval(() => {
        if (isCleanedUp) return;

        const elapsed = Date.now() - startTime;
        const stageProgress = Math.min(elapsed / (stage?.duration ?? 1000), 1);
        const totalProgress = baseProgress + stageProgress * stageProgressRange;

        setProgress(Math.round(totalProgress));

        if (stageProgress >= 1) {
          clearInterval(intervalId);
          // 다음 단계로 진행
          timeoutId = setTimeout(() => runStage(stageIndex + 1), 100);
        }
      }, 50);
    };

    // 첫 번째 단계 시작
    runStage(0);

    // 안전장치: 최대 5초 후 강제 완료
    const safetyTimer = setTimeout(() => {
      if (!isCompleted) {
        logger.info('⏰ 순차 로딩 타임아웃 - 강제 완료');
        handleComplete();
      }
    }, 5000);

    return () => {
      cleanup();
      clearTimeout(safetyTimer);
    };
  }, [skipCondition, isCompleted, handleComplete, phases]);

  // 클릭으로 스킵 (2초 후 활성화)
  useEffect(() => {
    let clickHandler: (() => void) | null = null;

    const enableSkipTimer = setTimeout(() => {
      clickHandler = () => {
        if (!isCompleted) {
          logger.info('👆 클릭으로 순차 로딩 스킵');
          handleComplete();
        }
      };
      document.addEventListener('click', clickHandler);
    }, 2000);

    return () => {
      clearTimeout(enableSkipTimer);
      if (clickHandler) {
        document.removeEventListener('click', clickHandler);
      }
    };
  }, [handleComplete, isCompleted]);

  return {
    isLoading,
    progress,
    currentStage: currentStage < phases.length ? phases[currentStage] : null,
    stageDescription:
      currentStage < phases.length
        ? (phases[currentStage]?.description ?? '처리중')
        : '완료',
    totalStages: phases.length,
    currentStageIndex: currentStage,
  };
};
