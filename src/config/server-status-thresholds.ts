/**
 * 🚨 서버 상태 판별 통합 기준
 *
 * 모든 서버 상태 판별 로직에서 사용하는 통합 임계값
 * 웹 알림 시스템도 이 기준을 따름
 */

export interface ServerStatusThresholds {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  disk: {
    warning: number;
    critical: number;
  };
  responseTime: {
    warning: number; // ms
    critical: number; // ms
  };
  networkLatency: {
    warning: number; // ms
    critical: number; // ms
  };
}

/**
 * 🎯 통합 서버 상태 임계값
 *
 * 기준:
 * - Warning: 주의 필요, 모니터링 강화
 * - Critical: 즉시 조치 필요, 웹 알림 발송
 */
export const SERVER_STATUS_THRESHOLDS: ServerStatusThresholds = {
  cpu: {
    warning: 75, // CPU 75% 이상
    critical: 90, // CPU 90% 이상
  },
  memory: {
    warning: 80, // 메모리 80% 이상
    critical: 95, // 메모리 95% 이상
  },
  disk: {
    warning: 85, // 디스크 85% 이상
    critical: 95, // 디스크 95% 이상
  },
  responseTime: {
    warning: 2000, // 응답시간 2초 이상
    critical: 5000, // 응답시간 5초 이상
  },
  networkLatency: {
    warning: 100, // 네트워크 지연 100ms 이상
    critical: 300, // 네트워크 지연 300ms 이상
  },
};

/**
 * 🔍 서버 상태 판별 함수
 *
 * @param metrics 서버 메트릭
 * @returns 서버 상태 ('online' | 'warning' | 'critical') - JSON SSOT 통일
 */
export interface ThresholdMetrics {
  cpu: number;
  memory: number;
  disk?: number;
  responseTime?: number;
  networkLatency?: number;
}

export function determineServerStatus(
  metrics: ThresholdMetrics
): 'online' | 'warning' | 'critical' {
  const {
    cpu,
    memory,
    disk = 0,
    responseTime = 0,
    networkLatency = 0,
  } = metrics;
  const thresholds = SERVER_STATUS_THRESHOLDS;

  // Critical 조건 (하나라도 해당하면 Critical)
  if (
    cpu > thresholds.cpu.critical ||
    memory > thresholds.memory.critical ||
    disk > thresholds.disk.critical ||
    responseTime > thresholds.responseTime.critical ||
    networkLatency > thresholds.networkLatency.critical
  ) {
    return 'critical';
  }

  // Warning 조건 (하나라도 해당하면 Warning)
  if (
    cpu > thresholds.cpu.warning ||
    memory > thresholds.memory.warning ||
    disk > thresholds.disk.warning ||
    responseTime > thresholds.responseTime.warning ||
    networkLatency > thresholds.networkLatency.warning
  ) {
    return 'warning';
  }

  return 'online';
}

/**
 * 🔔 웹 알림 발송 조건 확인
 *
 * @param currentStatus 현재 상태
 * @param previousStatus 이전 상태 (상태 변화 감지용)
 * @returns 웹 알림 발송 여부
 */
export function shouldSendWebNotification(
  currentStatus: 'online' | 'warning' | 'critical',
  previousStatus?: 'online' | 'warning' | 'critical'
): boolean {
  // Critical 상태는 항상 알림
  if (currentStatus === 'critical') {
    return true;
  }

  // Online에서 Warning으로 변화한 경우 알림
  if (currentStatus === 'warning' && previousStatus === 'online') {
    return true;
  }

  // 복구 알림: Critical에서 Warning/Online으로 변화
  if (
    previousStatus === 'critical' &&
    (currentStatus === 'warning' || currentStatus === 'online')
  ) {
    return true;
  }

  return false;
}

/**
 * 🎨 상태별 배경 색상 반환
 */
export function getStatusBgColor(
  status: 'online' | 'warning' | 'critical'
): string {
  switch (status) {
    case 'online':
      return 'bg-green-50 border-green-200';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

/**
 * 📊 상태별 아이콘 반환
 */
export function getStatusIcon(
  status: 'online' | 'warning' | 'critical'
): string {
  switch (status) {
    case 'online':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'critical':
      return '🚨';
    default:
      return '❓';
  }
}

/**
 * 🔧 AI 엔진 리팩토링 계획 v1.0
 *
 * 현재 상태: 44개 AI 엔진 클래스 → 25개 목표
 * 주요 문제: UnifiedAIEngine 1798줄, 중복 기능 다수
 *
 * 📅 2025.06.20 분석 기준
 */

export const AI_ENGINE_REFACTORING_PLAN = {
  // 🎯 현재 상태 분석
  current: {
    totalEngines: 44,
    mainEngines: 1, // SupabaseRAGMainEngine만 사용
    duplicateEngines: 12,
    unusedEngines: 6,
    largestClass: {
      name: 'UnifiedAIEngine',
      lines: 1798,
      responsibilities: 8,
    },
  },

  // 🎯 목표 상태
  target: {
    totalEngines: 25,
    maxLinesPerClass: 500,
    duplicateEngines: 0,
    unusedEngines: 0,
    solidPrinciples: true,
  },

  // 🔥 Phase 1: UnifiedAIEngine 분할 (최우선)
  phase1: {
    duration: '1주',
    priority: 'critical',
    tasks: [
      {
        name: 'MCPManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 250,
        responsibility: 'MCP Client 관리',
      },
      {
        name: 'CloudRunAIManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 200,
        responsibility: 'Cloud Run AI 연동 (Mistral)',
      },
      {
        name: 'RAGManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 300,
        responsibility: 'RAG Engine 통합',
      },
      {
        name: 'CacheManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 150,
        responsibility: '캐시 관리',
      },
      {
        name: 'StatsManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 200,
        responsibility: '통계 수집',
      },
      {
        name: 'DegradationManager 분리',
        from: 'UnifiedAIEngine',
        targetLines: 250,
        responsibility: 'Graceful Degradation',
      },
    ],
  },

  // ⚠️ Phase 2: 중복 엔진 통합 (중간 우선순위)
  phase2: {
    duration: '1주',
    priority: 'high',
    tasks: [
      {
        name: 'ML 엔진 통합',
        status: '✅ 완료 (GCP ML Provider로 대체)',
        merge: ['TransformersEngine', 'LightweightMLEngine'],
        into: 'MLProvider (Cloud Run)',
        expectedSaving: '400줄',
      },
      {
        name: 'NLP 엔진 통합',
        merge: ['SimplifiedNaturalLanguageEngine', 'KoreanAIEngine'],
        into: 'NLPEngine',
        expectedSaving: '350줄',
      },
      {
        name: 'Correlation 통합',
        merge: ['CorrelationEngine'],
        into: 'MasterAIEngine',
        expectedSaving: '354줄',
      },
    ],
  },

  // 📈 Phase 3: 팩토리 패턴 통합 (장기)
  phase3: {
    duration: '1주',
    priority: 'medium',
    tasks: [
      {
        name: '팩토리 통합',
        merge: ['EngineFactory', 'AIEngineFactory', 'EngineStatsManager'],
        into: 'UnifiedAIEngineFactory',
        expectedSaving: '200줄',
      },
    ],
  },

  // 📊 예상 효과
  expectedResults: {
    codeReduction: '30%', // ~1500줄 감소
    buildTime: '40% 빠름',
    memoryUsage: '25% 감소',
    maintainability: '현저한 개선',
    testability: '크게 향상',
  },

  // ⚠️ 리스크 관리
  risks: {
    breakingChanges: {
      level: 'medium',
      mitigation: '단계별 마이그레이션, 기존 API 유지',
    },
    regressionBugs: {
      level: 'low',
      mitigation: '포괄적 테스트 스위트 실행',
    },
    performanceImpact: {
      level: 'minimal',
      mitigation: '벤치마크 테스트로 검증',
    },
  },
};

// 🎯 서버 상태 임계값 (기존 기능 유지)
export const SERVER_STATUS_THRESHOLDS_OLD = {
  cpu: {
    warning: 75,
    critical: 90,
  },
  memory: {
    warning: 80,
    critical: 95,
  },
  disk: {
    warning: 85,
    critical: 95,
  },
  network: {
    warning: 100, // Mbps
    critical: 150,
  },
  responseTime: {
    warning: 1000, // ms
    critical: 3000,
  },
} as const;

export type ServerStatusThresholdsOld = typeof SERVER_STATUS_THRESHOLDS_OLD;
