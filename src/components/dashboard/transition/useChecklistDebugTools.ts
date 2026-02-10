import { useEffect } from 'react';
import type {
  ComponentStatus,
  DebugInfo,
  SystemComponent,
  WindowWithDebug,
} from '@/types/system-checklist';
import debug from '@/utils/debug';

/**
 * 전역 개발자 디버그 도구를 등록하는 훅
 *
 * SystemChecklist의 디버그 기능을 window 객체에 등록하여
 * 브라우저 콘솔에서 접근 가능하게 합니다.
 */
export function useChecklistDebugTools({
  components,
  componentDefinitions,
  debugInfo,
  isCompleted,
  canSkip,
  showCompleted,
  shouldProceed,
  totalProgress,
  showDebugPanel,
  onComplete,
  setShouldProceed,
  setShowDebugPanel,
}: {
  components: Record<string, ComponentStatus>;
  componentDefinitions: SystemComponent[];
  debugInfo: DebugInfo;
  isCompleted: boolean;
  canSkip: boolean;
  showCompleted: boolean;
  shouldProceed: boolean;
  totalProgress: number;
  showDebugPanel: boolean;
  onComplete: () => void;
  setShouldProceed: (v: boolean) => void;
  setShowDebugPanel: (v: boolean) => void;
}) {
  useEffect(() => {
    const advancedDebugTools = {
      getState: () => ({
        components,
        debugInfo,
        isCompleted,
        canSkip,
        showCompleted,
        shouldProceed,
        totalProgress,
      }),

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

      exportDebugInfo: () => {
        const exportData = {
          ...debugInfo,
          timestamp: new Date().toISOString(),
          components,
          isCompleted,
          totalProgress,
        };

        debug.log('📤 디버그 정보 내보내기:', exportData);

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard
            .writeText(JSON.stringify(exportData, null, 2))
            .then(() => debug.log('📋 클립보드에 복사 완료'))
            .catch((err) => debug.error('📋 클립보드 복사 실패:', err));
        }

        return exportData;
      },

      forceComplete: () => {
        debug.log('🚨 SystemChecklist 강제 완료 실행');
        setShouldProceed(true);
        onComplete();
      },

      toggleDebugPanel: () => {
        setShowDebugPanel(!showDebugPanel);
        return !showDebugPanel;
      },
    };

    (window as unknown as WindowWithDebug).debugSystemChecklistAdvanced =
      advancedDebugTools;
    (window as unknown as WindowWithDebug).systemChecklistDebug =
      advancedDebugTools;

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
    setShouldProceed,
    setShowDebugPanel,
  ]);
}
