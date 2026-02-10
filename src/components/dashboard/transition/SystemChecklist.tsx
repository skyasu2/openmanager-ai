/**
 * 🔧 SystemChecklist Component v3.0
 *
 * 미니멀하고 시각적인 시스템 체크리스트 + 강화된 개발자 도구
 * - 텍스트 최소화, 아이콘 중심 디자인
 * - 화면 깜박임 방지
 * - 실제 검증 실패 시 대기
 * - 강화된 실패 디버깅 시스템
 * - 개발자 도구 통합
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSystemChecklist } from '@/hooks/useSystemChecklist';
import type {
  DebugInfo,
  ErrorInfo,
  NetworkRequest,
  SystemChecklistProps,
  WindowWithDebug,
} from '@/types/system-checklist';
import debug from '@/utils/debug';
import { ChecklistItem } from './ChecklistItem';
import { CompletionOverlay } from './CompletionOverlay';
import { DebugPanel } from './DebugPanel';

export default function SystemChecklist({
  onComplete,
  skipCondition = false,
}: SystemChecklistProps) {
  const {
    components,
    componentDefinitions,
    isCompleted,
    totalProgress,
    completedCount,
    failedCount,
    loadingCount,
    canSkip,
  } = useSystemChecklist({
    onComplete,
    skipCondition,
    autoStart: true,
  });

  const [showCompleted, setShowCompleted] = useState(false);
  const [shouldProceed, setShouldProceed] = useState(false);

  // 🔍 디버깅 정보 상태
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    timestamp: new Date().toISOString(),
    componentStates: {},
    networkRequests: [],
    errors: [],
    performance: {
      startTime: Date.now(),
      checklistDuration: 0,
      slowestComponent: '',
      fastestComponent: '',
      averageResponseTime: 0,
    },
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
  });

  const [showDebugPanel, setShowDebugPanel] = useState(
    process.env.NEXT_PUBLIC_NODE_ENV || process.env.NODE_ENV === 'development'
  );

  // 🔍 네트워크 요청 모니터링
  const _trackNetworkRequest = (
    url: string,
    method: string,
    startTime: number,
    success: boolean,
    status?: number,
    error?: string
  ) => {
    const request: NetworkRequest = {
      url,
      method,
      status: status || (success ? 200 : 500),
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      success,
      error,
    };

    setDebugInfo((prev) => ({
      ...prev,
      networkRequests: [...prev.networkRequests.slice(-9), request], // 최근 10개만 유지
    }));
  };

  // 🔍 에러 추적
  const _trackError = (component: string, error: string, stack?: string) => {
    const errorInfo: ErrorInfo = {
      component,
      error,
      stack,
      timestamp: new Date().toISOString(),
      retryCount:
        (window as unknown as WindowWithDebug)[`retry_${component}`] || 0,
    };

    setDebugInfo((prev) => ({
      ...prev,
      errors: [...prev.errors.slice(-4), errorInfo], // 최근 5개만 유지
    }));

    // debug 유틸리티로 상세 에러 로그
    debug.group(`🚨 SystemChecklist 에러: ${component}`);
    debug.error('에러 메시지:', error);
    debug.error('타임스탬프:', errorInfo.timestamp);
    debug.error('재시도 횟수:', errorInfo.retryCount);
    if (stack) debug.error('스택 트레이스:', stack);
    debug.error('컴포넌트 상태:', components[component] || 'unknown');
    debug.groupEnd();
  };

  // 🔍 성능 정보 업데이트
  const updatePerformanceInfo = useCallback(() => {
    const responseTimes: number[] = [];
    let slowestComponent = '';
    let fastestComponent = '';
    let slowestTime = 0;
    let fastestTime = Infinity;

    Object.entries(components).forEach(([id, status]) => {
      if (status.startTime && status.completedTime) {
        const responseTime = status.completedTime - status.startTime;
        responseTimes.push(responseTime);

        const component = componentDefinitions.find((c) => c.id === id);
        const componentName = component?.name || id;

        if (responseTime > slowestTime) {
          slowestTime = responseTime;
          slowestComponent = componentName;
        }

        if (responseTime < fastestTime) {
          fastestTime = responseTime;
          fastestComponent = componentName;
        }
      }
    });

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    setDebugInfo((prev) => ({
      ...prev,
      performance: {
        ...prev.performance,
        checklistDuration: Date.now() - prev.performance.startTime,
        slowestComponent,
        fastestComponent,
        averageResponseTime,
      },
    }));
  }, [components, componentDefinitions]);

  // 🔍 디버깅 정보 실시간 업데이트
  useEffect(() => {
    setDebugInfo((prev) => ({
      ...prev,
      timestamp: new Date().toISOString(),
      componentStates: { ...components },
    }));

    updatePerformanceInfo();
  }, [components, updatePerformanceInfo]);

  // ✅ 완료 상태 모니터링 및 자동 전환
  useEffect(() => {
    if (isCompleted && !showCompleted) {
      setShowCompleted(true);

      // 2초 후 자동 전환 (사용자가 클릭 안 할 경우)
      const autoCompleteTimer = setTimeout(() => {
        setShouldProceed(true);
        setTimeout(() => onComplete(), 500); // 애니메이션 완료 후
      }, 2000);

      return () => clearTimeout(autoCompleteTimer);
    }
    return undefined;
  }, [isCompleted, showCompleted, onComplete]);

  // 키보드 단축키 (이미 훅에서 처리되고 있지만 추가 재시도 기능)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        debug.log('🔄 SystemChecklist 재시도 실행');
        window.location.reload();
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(!showDebugPanel);
        // 디버그 패널 토글
        debug.log('🛠️ 디버그 패널 토글:', !showDebugPanel);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDebugPanel]);

  // 🛠️ 강화된 전역 개발자 도구 등록
  useEffect(() => {
    const advancedDebugTools = {
      // 기본 상태 정보
      getState: () => ({
        components,
        debugInfo,
        isCompleted,
        canSkip,
        showCompleted,
        shouldProceed,
        totalProgress,
      }),

      // 컴포넌트별 상세 분석
      analyzeComponent: (componentId: string) => {
        const component = componentDefinitions.find(
          (c) => c.id === componentId
        );
        const status = components[componentId];

        debug.group(`🔍 컴포넌트 분석: ${component?.name || componentId}`);
        debug.log('컴포넌트 정의:', component);
        debug.log('현재 상태:', status);
        debug.log(
          '에러 히스토리:',
          debugInfo.errors.filter((e) => e.component === componentId)
        );
        debug.log(
          '네트워크 요청:',
          debugInfo.networkRequests.filter((r) => r.url.includes(componentId))
        );
        debug.groupEnd();

        return {
          component,
          status,
          errors: debugInfo.errors.filter((e) => e.component === componentId),
        };
      },

      // 실패한 컴포넌트만 재시도
      retryFailedComponents: () => {
        const failedComponents = Object.entries(components)
          .filter(([_, status]) => status.status === 'failed')
          .map(([id]) => id);

        debug.log('🔄 실패한 컴포넌트 재시도:', failedComponents);

        if (failedComponents.length === 0) {
          debug.log('✅ 실패한 컴포넌트 없음');
          return;
        }

        window.location.reload();
      },

      // 네트워크 진단
      diagnoseNetwork: () => {
        const networkStats = {
          totalRequests: debugInfo.networkRequests.length,
          successRate:
            debugInfo.networkRequests.filter((r) => r.success).length /
            debugInfo.networkRequests.length,
          averageResponseTime:
            debugInfo.networkRequests.reduce(
              (sum, r) => sum + r.responseTime,
              0
            ) / debugInfo.networkRequests.length,
          slowestRequest: debugInfo.networkRequests.reduce(
            (slowest, current) =>
              current.responseTime > (slowest?.responseTime ?? 0)
                ? current
                : slowest,
            debugInfo.networkRequests[0]
          ),
          failedRequests: debugInfo.networkRequests.filter((r) => !r.success),
        };

        debug.group('🌐 네트워크 진단');
        debug.log('통계:', networkStats);
        debug.log('모든 요청:', debugInfo.networkRequests);
        debug.groupEnd();

        return networkStats;
      },

      // 성능 분석
      analyzePerformance: () => {
        debug.group('⚡ 성능 분석');
        debug.log(
          '체크리스트 총 시간:',
          `${debugInfo.performance.checklistDuration}ms`
        );
        debug.log(
          '가장 느린 컴포넌트:',
          debugInfo.performance.slowestComponent
        );
        debug.log(
          '가장 빠른 컴포넌트:',
          debugInfo.performance.fastestComponent
        );
        debug.log(
          '평균 응답 시간:',
          `${debugInfo.performance.averageResponseTime}ms`
        );
        debug.groupEnd();

        return debugInfo.performance;
      },

      // 디버그 정보 내보내기
      exportDebugInfo: () => {
        const exportData = {
          ...debugInfo,
          timestamp: new Date().toISOString(),
          components,
          isCompleted,
          totalProgress,
        };

        debug.log('📤 디버그 정보 내보내기:', exportData);

        // 클립보드에 복사 (브라우저에서만)
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard
            .writeText(JSON.stringify(exportData, null, 2))
            .then(() => debug.log('📋 클립보드에 복사 완료'))
            .catch((err) => debug.error('📋 클립보드 복사 실패:', err));
        }

        return exportData;
      },

      // 강제 완료 (안전 장치)
      forceComplete: () => {
        debug.log('🚨 SystemChecklist 강제 완료 실행');
        setShouldProceed(true);
        onComplete();
      },

      // 디버그 패널 토글
      toggleDebugPanel: () => {
        setShowDebugPanel(!showDebugPanel);
        return !showDebugPanel;
      },
    };

    // 전역 등록
    (window as unknown as WindowWithDebug).debugSystemChecklistAdvanced =
      advancedDebugTools;
    (window as unknown as WindowWithDebug).systemChecklistDebug =
      advancedDebugTools; // 짧은 별칭

    // 기존 함수들도 유지
    (window as unknown as WindowWithDebug).debugSystemChecklist = {
      components,
      componentDefinitions,
      isCompleted,
      canSkip,
      totalProgress,
      debugInfo,
    };

    (window as unknown as WindowWithDebug).emergencyCompleteChecklist =
      advancedDebugTools.forceComplete;

    // 개발 환경에서만 디버그 정보 출력
    debug.group('🛠️ SystemChecklist 개발자 도구 사용 가능');
    debug.log('기본 정보:', 'debugSystemChecklist');
    debug.log('고급 도구:', 'systemChecklistDebug.*');
    debug.log('강제 완료:', 'emergencyCompleteChecklist()');
    debug.log(
      '디버그 패널:',
      'D키 또는 systemChecklistDebug.toggleDebugPanel()'
    );
    debug.groupEnd();
  }, [
    components,
    componentDefinitions,
    isCompleted,
    canSkip,
    totalProgress,
    debugInfo,
    showCompleted,
    shouldProceed,
    onComplete,
    showDebugPanel,
  ]);

  // 스킵된 경우 즉시 완료 처리
  if (isCompleted && skipCondition) {
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* 배경 애니메이션 */}
      <div className="absolute inset-0 opacity-10">
        <div className="animate-pulse absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
        <div className="animate-pulse absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500 blur-3xl delay-1000" />
      </div>

      {/* 🛠️ 개발자 디버그 패널 */}
      {showDebugPanel && (
        <DebugPanel
          debugInfo={debugInfo}
          totalProgress={totalProgress}
          completedCount={completedCount}
          failedCount={failedCount}
          loadingCount={loadingCount}
          onClose={() => setShowDebugPanel(false)}
        />
      )}

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-300 ${
          shouldProceed ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 로고 섹션 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-r from-blue-500 to-purple-600 shadow-2xl">
            <span className="text-2xl font-bold text-white">OM</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">OpenManager</h1>
          <p className="text-sm text-gray-300">시스템 초기화 중...</p>
        </div>

        {/* 전체 진행률 */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              전체 진행률
            </span>
            <span className="text-sm font-bold text-white">
              {totalProgress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700/50">
            <div
              className="h-full rounded-full bg-linear-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        {/* 컴팩트한 체크리스트 */}
        <div className="space-y-2">
          {componentDefinitions.map((component) => {
            const status = components[component.id];
            if (!status) return null;

            return (
              <ChecklistItem
                key={component.id}
                component={component}
                status={status}
              />
            );
          })}
        </div>

        {/* 상태 정보 */}
        <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-gray-300">완료 {completedCount}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-gray-300">실패 {failedCount}</span>
          </div>
        </div>

        {/* 에러 시 재시도 버튼 */}
        {failedCount > 0 && (
          <div className="mt-4 space-y-2 text-center">
            <button
              type="button"
              onClick={() =>
                (
                  window as unknown as WindowWithDebug
                ).systemChecklistDebug?.retryFailedComponents()
              }
              className="mr-2 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/30"
            >
              재시도 (R)
            </button>

            {process.env.NEXT_PUBLIC_NODE_ENV ||
              (process.env.NODE_ENV === 'development' && (
                <button
                  type="button"
                  onClick={() =>
                    (
                      window as unknown as WindowWithDebug
                    ).systemChecklistDebug?.diagnoseNetwork()
                  }
                  className="rounded-lg border border-yellow-500/50 bg-yellow-500/20 px-4 py-2 text-sm text-yellow-300 transition-colors hover:bg-yellow-500/30"
                >
                  네트워크 진단
                </button>
              ))}
          </div>
        )}

        {/* 완료 상태 표시 */}
        {showCompleted && (
          <CompletionOverlay
            onProceed={() => {
              setShouldProceed(true);
              setTimeout(() => onComplete(), 100);
            }}
          />
        )}

        {/* 스킵 버튼 (3초 후 표시) */}
        {canSkip && !showCompleted && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onComplete}
              className="rounded-lg border border-blue-500/50 bg-blue-500/20 px-4 py-2 text-sm text-blue-300 transition-colors hover:bg-blue-500/30"
            >
              건너뛰기 (ESC)
            </button>
          </div>
        )}

        {/* 단축키 안내 */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>ESC/Space: 건너뛰기 • R: 재시도 • D: 디버그 패널</p>
        </div>
      </div>

      {/* 돌아가기 버튼 (왼쪽 아래 고정) */}
      <div className="absolute bottom-6 left-6 z-20">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.back();
            }
          }}
          className="flex items-center space-x-2 rounded-lg border border-gray-600/50 bg-gray-700/80 px-4 py-2 text-gray-300 backdrop-blur-sm transition-all duration-200 hover:bg-gray-600/80 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/50"
          title="이전 페이지로 돌아가기"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span className="text-sm">돌아가기</span>
        </button>
      </div>
    </div>
  );
}
