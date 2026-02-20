import type { GeneratedLog } from './log-generator';

// ============================================================================
// Types
// ============================================================================

/** 서버 상태 (JSON SSOT와 동일한 용어 사용) */
export type ServerStatus = 'online' | 'warning' | 'critical' | 'offline';

/** 트렌드 방향 */
export type TrendDirection = 'up' | 'down' | 'stable';

/** 개별 서버 알림 */
export interface ServerAlert {
  serverId: string;
  serverName: string;
  serverType: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  trend: TrendDirection;
  severity: 'warning' | 'critical';
}

/** 서버 스냅샷 (LLM용 정보, 확장 메트릭 포함) */
export interface ServerSnapshot {
  id: string;
  name: string;
  type: string;
  status: ServerStatus;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  // 확장 메트릭 (AI 컨텍스트 강화)
  load1?: number;           // 1분 평균 로드
  load5?: number;           // 5분 평균 로드
  bootTimeSeconds?: number; // 부팅 시간 (Unix timestamp)
  responseTimeMs?: number;  // 응답 시간 (ms)
  cpuCores?: number;        // CPU 코어 수 (load 해석용)
}

/** 활성 패턴 (시나리오명 숨김) */
export interface ActivePattern {
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  pattern: 'spike' | 'gradual' | 'oscillate' | 'sustained' | 'normal';
  severity: 'info' | 'warning' | 'critical';
}

/** Pre-computed 슬롯 (10분 단위) */
export interface PrecomputedSlot {
  slotIndex: number;           // 0-143
  timeLabel: string;           // "14:30"
  minuteOfDay: number;         // 0-1430

  // 요약 통계
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
  };

  // 알림 목록 (warning/critical만)
  alerts: ServerAlert[];

  // 활성 패턴 (시나리오명 없이)
  activePatterns: ActivePattern[];

  // 전체 서버 스냅샷 (상세 조회용)
  servers: ServerSnapshot[];

  /** 서버별 주요 로그 (AI 컨텍스트용, 서버당 최대 5개) */
  serverLogs: Record<string, GeneratedLog[]>;
}

/** LLM용 압축 컨텍스트 */
export interface CompactContext {
  date: string;
  time: string;
  timestamp: string;
  summary: string;
  critical: Array<{ server: string; issue: string }>;
  warning: Array<{ server: string; issue: string }>;
  patterns: string[];
  thresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
    network: { warning: number; critical: number };
  };
  serverRoles: Array<{ id: string; name: string; type: string }>;
}

// ============================================================================
// Thresholds (from system-rules.json - Single Source of Truth)
// ============================================================================

export interface ThresholdConfig {
  warning: number;
  critical: number;
}

export interface SystemRulesThresholds {
  cpu: ThresholdConfig;
  memory: ThresholdConfig;
  disk: ThresholdConfig;
  network: ThresholdConfig;
}
