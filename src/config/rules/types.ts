/**
 * 🎯 지식의 외부화 (Knowledge Externalization) - 타입 정의
 *
 * 하드코딩된 임계값을 외부 설정으로 관리하여:
 * - Single Source of Truth 확보
 * - 배포 없이 동적 변경 가능
 * - AI가 규칙을 참조하여 정확한 답변 제공
 *
 * @see docs/core/architecture/design/knowledge-externalization.md
 */

/**
 * 메트릭 임계값 정의
 */
export interface MetricThreshold {
  /** 경고 수준 (warning) */
  warning: number;
  /** 심각 수준 (critical) */
  critical: number;
  /** 복구 수준 (recovery) — 이 값 이하로 떨어져야 정상 복귀 판정 */
  recovery?: number;
  /** 설명 (AI 참조용) */
  description?: string;
}

/**
 * 서버 상태 결정 규칙
 *
 * Prometheus alerting rules의 `for` 개념을 반영:
 * - 실제 Prometheus에서는 조건이 `for` 기간 동안 지속되어야 firing 상태로 전환
 * - OpenManager AI에서는 교육적 참조용으로 기록하며, 10분 데이터 슬롯 특성상
 *   실제 지속시간 검증은 시뮬레이션 수준으로 처리
 */
export interface ServerStatusRule {
  /** 규칙 이름 */
  name: string;
  /** 상태 결정 조건 (자연어) */
  condition: string;
  /** 결과 상태 */
  resultStatus: 'online' | 'warning' | 'critical' | 'offline';
  /** 우선순위 (낮을수록 우선) */
  priority: number;
  /**
   * Prometheus 스타일 지속시간 조건 (e.g. "5m", "10m")
   *
   * 실제 Prometheus alerting에서는 조건이 이 기간 동안 연속으로 충족되어야
   * alert가 firing 상태로 전환됩니다. OpenManager AI의 10분 간격 데이터에서는
   * 이전 슬롯과 비교하여 지속 여부를 판단합니다.
   */
  for?: string;
}

/**
 * 알림 규칙
 */
export interface AlertRule {
  /** 규칙 ID */
  id: string;
  /** 규칙 이름 */
  name: string;
  /** 메트릭 타입 */
  metricType: 'cpu' | 'memory' | 'disk' | 'network' | 'response_time';
  /** 연산자 */
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  /** 임계값 */
  threshold: number;
  /** 심각도 */
  severity: 'info' | 'warning' | 'critical';
  /** 활성화 여부 */
  enabled: boolean;
  /** 설명 */
  description?: string;
}

/**
 * 시스템 규칙 전체 스키마
 */
export interface SystemRules {
  /** 규칙 버전 */
  version: string;
  /** 마지막 업데이트 */
  lastUpdated: string;
  /** 메트릭별 임계값 */
  thresholds: {
    cpu: MetricThreshold;
    memory: MetricThreshold;
    disk: MetricThreshold;
    network: MetricThreshold;
    responseTime: MetricThreshold;
  };
  /** 서버 상태 결정 규칙 */
  statusRules: ServerStatusRule[];
  /** 알림 규칙 */
  alertRules: AlertRule[];
  /** 메타데이터 (AI 참조용) */
  metadata: {
    description: string;
    maintainer: string;
    aiInstructions: string;
  };
}

/**
 * 규칙 로더 인터페이스
 */
export interface IRulesLoader {
  /** 전체 규칙 로드 */
  getRules(): SystemRules;
  /** 특정 메트릭의 임계값 조회 */
  getThreshold(metric: keyof SystemRules['thresholds']): MetricThreshold;
  /** 값이 경고 수준인지 확인 */
  isWarning(metric: keyof SystemRules['thresholds'], value: number): boolean;
  /** 값이 심각 수준인지 확인 */
  isCritical(metric: keyof SystemRules['thresholds'], value: number): boolean;
  /** 값에 따른 상태 결정 */
  getStatus(
    metric: keyof SystemRules['thresholds'],
    value: number
  ): 'normal' | 'warning' | 'critical';
  /** 규칙 새로고침 (향후 DB 연동용) */
  refresh(): Promise<void>;
}
