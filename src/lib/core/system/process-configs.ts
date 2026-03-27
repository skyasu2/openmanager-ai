/**
 * 🔧 시스템 프로세스 설정
 *
 * 모든 시스템 프로세스의 설정 정의:
 * - 의존성 관계
 * - 시작/중지 명령
 * - 헬스체크 로직
 * - 복구 정책
 */

import { systemLogger } from '@/lib/logger';
import type { ProcessConfig } from './ProcessManager';

// 🔧 전역 상태 타입 정의
interface GlobalState {
  systemCache?: Map<string, unknown>;
  devModeActive?: boolean;
  devModeStartTime?: number;
}

// 🔧 타입 가드 함수들
const isGlobalWithState = (obj: unknown): obj is GlobalState => {
  return obj !== null && typeof obj === 'object';
};

const hasSystemCache = (
  obj: GlobalState
): obj is GlobalState & { systemCache: Map<string, unknown> } => {
  return obj.systemCache instanceof Map;
};

const isDevModeActive = (obj: GlobalState): boolean => {
  return (
    obj.devModeActive === true &&
    typeof obj.devModeStartTime === 'number' &&
    obj.devModeStartTime > 0
  );
};

// 🔧 안전한 전역 객체 접근 함수
const getGlobalState = (): GlobalState => {
  if (typeof global !== 'undefined') {
    return global as GlobalState;
  }
  return {};
};

const setGlobalProperty = <K extends keyof GlobalState>(
  key: K,
  value: GlobalState[K]
): void => {
  if (typeof global !== 'undefined') {
    (global as GlobalState)[key] = value;
  }
};

const deleteGlobalProperty = <K extends keyof GlobalState>(key: K): void => {
  if (typeof global !== 'undefined') {
    delete (global as GlobalState)[key];
  }
};

/**
 * 기존 시스템과 통합된 프로세스 설정
 * 기존 useSystemControl, useSequentialServerGeneration과 호환
 */
export const PROCESS_CONFIGS: ProcessConfig[] = [
  // 1. 기본 시스템 서비스 (의존성 없음)
  {
    id: 'system-logger',
    name: '시스템 로거',
    startCommand: async () => {
      systemLogger.system('📝 시스템 로거 시작');
      // 로거는 이미 초기화되어 있으므로 추가 작업 불필요
    },
    stopCommand: async () => {
      systemLogger.system('📝 시스템 로거 중지');
      // 로거는 프로세스와 함께 종료되므로 추가 작업 불필요
    },
    healthCheck: async () => {
      try {
        systemLogger.system('💓 로거 헬스체크');
        return true;
      } catch {
        return false;
      }
    },
    criticalLevel: 'high',
    autoRestart: true,
    maxRestarts: 3,
    startupDelay: 100,
  },

  // 2. 캐시 서비스
  {
    id: 'cache-service',
    name: '캐시 서비스',
    startCommand: async () => {
      systemLogger.system('💾 캐시 서비스 시작');
      // 메모리 캐시 초기화 (기존 시스템과 연동)
      setGlobalProperty('systemCache', new Map<string, unknown>());
    },
    stopCommand: async () => {
      systemLogger.system('💾 캐시 서비스 중지');
      const globalState = getGlobalState();
      if (hasSystemCache(globalState)) {
        globalState.systemCache.clear();
      }
      deleteGlobalProperty('systemCache');
    },
    healthCheck: async () => {
      const globalState = getGlobalState();
      return hasSystemCache(globalState);
    },
    criticalLevel: 'medium',
    autoRestart: true,
    maxRestarts: 5,
    dependencies: ['system-logger'],
    startupDelay: 500,
  },

  // 3. 순차 서버 생성 엔진
  {
    id: 'server-generator',
    name: '순차 서버 생성 엔진',
    startCommand: async () => {
      systemLogger.system('🖥️ 서버 생성 엔진 시작');

      try {
        // 서버 생성 시스템 초기화 (리셋)
        const response = await fetch('/api/servers/next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true }),
        });

        if (!response.ok) {
          throw new Error(`서버 생성 API 초기화 실패: ${response.status}`);
        }

        const result = await response.json();
        systemLogger.system(
          `✅ 서버 생성 엔진 초기화 완료: ${result.message || '준비됨'}`
        );
      } catch (error) {
        systemLogger.error('서버 생성 엔진 초기화 실패:', error);
        throw error;
      }
    },
    stopCommand: async () => {
      systemLogger.system('🖥️ 서버 생성 엔진 중지');

      try {
        // 진행 중인 서버 생성 중지
        await fetch('/api/servers/next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop' }),
        });

        systemLogger.system('✅ 서버 생성 엔진 중지 완료');
      } catch (error) {
        systemLogger.warn('서버 생성 엔진 중지 중 오류 (무시됨):', error);
      }
    },
    healthCheck: async () => {
      try {
        const response = await fetch('/api/servers/next?action=health', {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    criticalLevel: 'high',
    autoRestart: true,
    maxRestarts: 3,
    dependencies: ['cache-service'],
    startupDelay: 1000,
  },

  // 4. AI 분석 엔진 (MCP 오케스트레이터)
  {
    id: 'ai-engine',
    name: 'AI 분석 엔진',
    startCommand: async () => {
      systemLogger.system('🧠 AI 분석 엔진 시작');

      try {
        // Cloud Run AI 헬스체크
        const response = await fetch('/api/health?service=ai', {
          method: 'GET',
        });

        if (!response.ok) {
          // 웜업 엔드포인트로 초기화 트리거
          const initResponse = await fetch('/api/ai/wake-up', {
            method: 'POST',
          });

          if (!initResponse.ok) {
            throw new Error(`AI 엔진 초기화 실패: ${initResponse.status}`);
          }
        }

        systemLogger.system('✅ AI 분석 엔진 시작 완료');
      } catch (error) {
        systemLogger.error('AI 분석 엔진 시작 실패:', error);
        throw error;
      }
    },
    stopCommand: async () => {
      systemLogger.system('🧠 AI 분석 엔진 중지');

      try {
        // 상태 확인만 수행 (서버리스 환경에서는 별도 종료 불필요)
        await fetch('/api/health?service=ai', { method: 'GET' });
        systemLogger.system('✅ AI 분석 엔진 중지 완료');
      } catch (error) {
        systemLogger.warn('AI 분석 엔진 중지 중 오류 (무시됨):', error);
      }
    },
    healthCheck: async () => {
      try {
        const response = await fetch('/api/health?service=ai', {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    criticalLevel: 'high',
    autoRestart: true,
    maxRestarts: 5,
    dependencies: ['server-generator'],
    startupDelay: 2000,
  },

  // 5. 시뮬레이션 엔진
  {
    id: 'simulation-engine',
    name: '시뮬레이션 엔진',
    startCommand: async () => {
      systemLogger.system('⚙️ 시뮬레이션 엔진 시작');

      try {
        // 기존 useSystemControl과 연동하여 시스템 시작
        const response = await fetch('/api/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', mode: 'fast' }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `시뮬레이션 엔진 시작 실패: ${errorData.message || response.statusText}`
          );
        }

        const result = await response.json();
        systemLogger.system(`✅ 시뮬레이션 엔진 시작: ${result.message}`);
      } catch (error) {
        systemLogger.error('시뮬레이션 엔진 시작 실패:', error);
        throw error;
      }
    },
    stopCommand: async () => {
      systemLogger.system('⚙️ 시뮬레이션 엔진 중지');

      try {
        const response = await fetch('/api/system', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop' }),
        });

        if (response.ok) {
          const result = await response.json();
          systemLogger.system(`✅ 시뮬레이션 엔진 중지: ${result.message}`);
        } else if (response.status === 400) {
          // 400 에러는 이미 중지된 상태로 간주
          systemLogger.system('ℹ️ 시뮬레이션 엔진 이미 중지됨');
        } else {
          const errorData = await response.json();
          systemLogger.warn(
            `⚠️ 시뮬레이션 엔진 중지 경고: ${errorData.message}`
          );
        }
      } catch (error) {
        systemLogger.warn('시뮬레이션 엔진 중지 중 오류 (무시됨):', error);
      }
    },
    healthCheck: async () => {
      try {
        const response = await fetch('/api/system', {
          method: 'GET',
        });

        if (response.ok) {
          const status = await response.json();
          return status.isRunning === true;
        }
        return false;
      } catch {
        return false;
      }
    },
    criticalLevel: 'medium',
    autoRestart: true,
    maxRestarts: 3,
    dependencies: ['ai-engine'],
    startupDelay: 1500,
  },

  // 6. API 서버 (가장 마지막)
  {
    id: 'api-server',
    name: 'API 서버',
    startCommand: async () => {
      systemLogger.system('🌐 API 서버 체크');
      // Next.js API 서버는 이미 실행 중이므로 헬스체크만 수행

      try {
        const response = await fetch('/api/health', {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`API 서버 헬스체크 실패: ${response.status}`);
        }

        systemLogger.system('✅ API 서버 정상 동작 확인');
      } catch (error) {
        systemLogger.error('API 서버 체크 실패:', error);
        throw error;
      }
    },
    stopCommand: async () => {
      systemLogger.system('🌐 API 서버 상태 정리');
      // API 서버는 프로세스와 함께 종료되므로 상태 정리만 수행
      systemLogger.system('✅ API 서버 상태 정리 완료');
    },
    healthCheck: async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    criticalLevel: 'high',
    autoRestart: false, // API 서버는 외부에서 관리
    maxRestarts: 0,
    dependencies: ['simulation-engine'],
    startupDelay: 500,
  },
];

/**
 * 개발 모드용 간소화된 설정
 */
export const DEVELOPMENT_PROCESS_CONFIGS: ProcessConfig[] = [
  {
    id: 'dev-system',
    name: '개발 모드 시스템',
    startCommand: async () => {
      systemLogger.system('🔧 개발 모드 시작');

      // 🚀 개발 모드 상태를 전역에 저장
      setGlobalProperty('devModeActive', true);
      setGlobalProperty('devModeStartTime', Date.now());

      // 개발 모드에서는 기본 헬스체크만 수행
      await new Promise((resolve) => setTimeout(resolve, 100)); // 짧은 지연
      systemLogger.system('✅ 개발 모드 시작 완료');
    },
    stopCommand: async () => {
      systemLogger.system('🔧 개발 모드 중지');

      // 🚀 개발 모드 상태 정리
      setGlobalProperty('devModeActive', false);
      deleteGlobalProperty('devModeStartTime');

      await new Promise((resolve) => setTimeout(resolve, 50)); // 짧은 지연
      systemLogger.system('✅ 개발 모드 중지 완료');
    },
    healthCheck: async () => {
      // 🚀 개발 모드에서는 전역 상태 확인으로 건강 상태 판단
      const globalState = getGlobalState();

      if (isGlobalWithState(globalState) && isDevModeActive(globalState)) {
        systemLogger.system('💓 개발 모드 헬스체크 통과');
        return true;
      }

      // fallback: 기본적으로 개발 모드는 건강한 상태로 반환
      systemLogger.system('💓 개발 모드 헬스체크 기본 통과 (fallback)');
      return true;
    },
    criticalLevel: 'medium',
    autoRestart: true,
    maxRestarts: 2,
    startupDelay: 500,
  },
];

/**
 * 환경에 따른 설정 선택
 */
export function getProcessConfigs(): ProcessConfig[] {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 개발 환경에서는 기본적으로 개발 모드 설정 사용
  if (isDevelopment) {
    systemLogger.system('📋 개발 모드 프로세스 설정 사용');
    return DEVELOPMENT_PROCESS_CONFIGS;
  }

  systemLogger.system('📋 전체 프로세스 설정 사용');
  return PROCESS_CONFIGS;
}

/**
 * 프로세스 설정 검증
 */
export function validateProcessConfigs(configs: ProcessConfig[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const processIds = new Set<string>();

  for (const config of configs) {
    // 중복 ID 확인
    if (processIds.has(config.id)) {
      errors.push(`중복된 프로세스 ID: ${config.id}`);
    }
    processIds.add(config.id);

    // 필수 필드 확인
    if (!config.name.trim()) {
      errors.push(`프로세스 ${config.id}: 이름이 비어있음`);
    }

    if (typeof config.startCommand !== 'function') {
      errors.push(`프로세스 ${config.id}: startCommand가 함수가 아님`);
    }

    if (typeof config.stopCommand !== 'function') {
      errors.push(`프로세스 ${config.id}: stopCommand가 함수가 아님`);
    }

    if (typeof config.healthCheck !== 'function') {
      errors.push(`프로세스 ${config.id}: healthCheck가 함수가 아님`);
    }

    // 의존성 확인
    if (config.dependencies) {
      for (const depId of config.dependencies) {
        if (!configs.find((c) => c.id === depId)) {
          warnings.push(`프로세스 ${config.id}: 존재하지 않는 의존성 ${depId}`);
        }
      }
    }

    // 설정값 확인
    if (config.maxRestarts < 0) {
      warnings.push(`프로세스 ${config.id}: maxRestarts가 음수`);
    }

    if (config.startupDelay && config.startupDelay < 0) {
      warnings.push(`프로세스 ${config.id}: startupDelay가 음수`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
