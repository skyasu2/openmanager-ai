/**
 * 🔧 타임아웃 최적화 설정 - SystemConfiguration.ts와 통합
 * 중앙집중식 설정 시스템의 일부로 작동
 */

import { getSystemConfig } from '../../src/config/SystemConfiguration.js';

/**
 * 동적 타임아웃 관리자
 */
export class DynamicTimeoutManager {
  constructor() {
    this.config = getSystemConfig();
  }

  /**
   * API별 최적화된 타임아웃 반환
   */
  getApiTimeout(apiType = 'default') {
    const baseTimeout = this.config.api.timeoutMs;

    const multipliers = {
      'ai-query': 1.5,      // AI 쿼리는 더 오래 걸릴 수 있음
      'server-list': 0.8,   // 서버 리스트는 빨라야 함
      'metrics': 0.6,       // 메트릭은 실시간성이 중요
      'dashboard': 1.0,     // 대시보드는 기본값
      'default': 1.0
    };

    return Math.round(baseTimeout * (multipliers[apiType] || 1.0));
  }

  /**
   * 환경별 타임아웃 설정
   */
  getEnvironmentTimeout() {
    const env = this.config.environment.mode;

    switch (env) {
      case 'production':
        return this.config.api.timeoutMs * 0.8; // 프로덕션에서는 더 빠르게
      case 'staging':
        return this.config.api.timeoutMs * 1.2; // 스테이징은 여유롭게
      case 'development':
      default:
        return this.config.api.timeoutMs; // 개발환경은 기본값
    }
  }

  /**
   * 성능 기반 동적 타임아웃
   */
  getDynamicTimeout(requestSize = 'small') {
    const base = this.getEnvironmentTimeout();

    const sizeMultipliers = {
      'small': 0.8,
      'medium': 1.0,
      'large': 1.5,
      'bulk': 2.0
    };

    return Math.round(base * (sizeMultipliers[requestSize] || 1.0));
  }
}

/**
 * 글로벌 타임아웃 설정
 */
export const TIMEOUT_CONFIG = {
  // 기본 타임아웃들 (중앙집중식 설정에서 동적으로 로드)
  get DEFAULT_API_TIMEOUT() {
    return getSystemConfig().api.timeoutMs;
  },

  get CACHE_TTL() {
    return getSystemConfig().performance.cacheTtlMs;
  },

  get MAX_CONCURRENT_REQUESTS() {
    return getSystemConfig().performance.maxConcurrentRequests;
  },

  // 특정 용도별 타임아웃
  AI_QUERY: 15000,      // AI 쿼리는 고정값 (복잡한 추론 시간 고려)
  QUICK_API: 3000,      // 빠른 API
  HEALTH_CHECK: 1000,   // 헬스 체크

  // 환경별 기본값
  get ENVIRONMENT_BASE() {
    const manager = new DynamicTimeoutManager();
    return manager.getEnvironmentTimeout();
  }
};

/**
 * 타임아웃 관리자 싱글톤 인스턴스
 */
export const timeoutManager = new DynamicTimeoutManager();

/**
 * 편의 함수들
 */
export const getOptimizedTimeout = (apiType, requestSize = 'small') => {
  return timeoutManager.getDynamicTimeout(requestSize);
};

export const getApiSpecificTimeout = (apiType) => {
  return timeoutManager.getApiTimeout(apiType);
};

// 기본 export
export default {
  TIMEOUT_CONFIG,
  DynamicTimeoutManager,
  timeoutManager,
  getOptimizedTimeout,
  getApiSpecificTimeout
};