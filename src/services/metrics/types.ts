// ============================================================================
// MetricsProvider Types (from MetricsProvider.ts SRP split, 2026-02-10)
// ============================================================================

/**
 * 서버 메트릭 (API 응답용)
 */
export interface ServerMetrics {
  serverId: string;
  serverType: string;
  location: string;
  timestamp: string; // ISO 8601
  minuteOfDay: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  logs: string[];
  status: 'online' | 'warning' | 'critical' | 'offline';
  /** nodeInfo - Prometheus target에서 추출한 하드웨어 정보 */
  nodeInfo?: {
    cpuCores: number;
    memoryTotalBytes: number;
    diskTotalBytes: number;
  };

  // Prometheus 확장 필드 (optional - 하위호환)
  hostname?: string;
  environment?: string;
  os?: string;
  osVersion?: string;
  loadAvg1?: number;
  loadAvg5?: number;
  bootTimeSeconds?: number;
  procsRunning?: number;
  responseTimeMs?: number;
}

/**
 * 전체 시스템 요약
 */
export interface SystemSummary {
  timestamp: string;
  minuteOfDay: number;
  totalServers: number;
  onlineServers: number;
  warningServers: number;
  criticalServers: number;
  offlineServers: number;
  averageCpu: number;
  averageMemory: number;
  averageDisk: number;
  averageNetwork: number;
}

/**
 * 시간 비교 결과 (현재 vs N분 전)
 */
export interface TimeComparisonResult {
  current: {
    timestamp: string;
    date: string;
    metrics: ServerMetrics;
  };
  past: {
    timestamp: string;
    date: string;
    metrics: ServerMetrics;
  };
  delta: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

// ============================================================================
// Legacy Types (variation-generator, cycle-engine)
// ============================================================================

export interface BaselineData {
  pattern_multiplier?: number;
  response_time_baseline?: number;
  cpu_baseline?: number;
  memory_baseline?: number;
  disk_baseline?: number;
  network_baseline?: number;
  network_in_baseline?: number;
  network_out_baseline?: number;
  performance_multiplier?: number;
}

export interface ScenarioData {
  type?: string;
  severity?: number | string;
  impact?: number;
  duration?: number;
  affected_metrics?: string[];
  recovery_time?: number;
  pattern?: {
    id?: string;
    severity?: string;
  };
}

export interface BaselineStorage {
  [serverId: string]: BaselineData;
}

// 10배 풍부한 메트릭 인터페이스
export interface EnrichedMetrics {
  // 🖥️ 시스템 메트릭 (기존)
  system: {
    cpu: {
      usage: number;
      load1: number;
      load5: number;
      load15: number;
      processes: number;
      threads: number;
      context_switches: number;
      interrupts: number;
    };
    memory: {
      used: number;
      available: number;
      buffers: number;
      cached: number;
      swap: { used: number; total: number };
      page_faults: number;
      memory_leaks: number;
    };
    disk: {
      io: { read: number; write: number };
      throughput: { read_mbps: number; write_mbps: number };
      utilization: number;
      queue_depth: number;
      latency: { read_ms: number; write_ms: number };
      errors: number;
    };
    network: {
      in_mbps: number;
      out_mbps: number;
      connections: number;
      errors: number;
      dropped_packets: number;
      retransmissions: number;
    };
  };

  // 🎯 애플리케이션 메트릭 (신규)
  application: {
    http: {
      requests_per_second: number;
      response_time_ms: number;
      error_rate: number;
      active_connections: number;
      queue_size: number;
    };
    database: {
      connections: number;
      query_time_ms: number;
      slow_queries: number;
      deadlocks: number;
      cache_hit_rate: number;
      cache_hit_rate_percent?: number; // 호환성 유지
    };
    cache: {
      hit_rate: number;
      memory_usage: number;
      evictions: number;
      operations_per_second: number;
    };
    sessions: {
      active_users: number;
      session_duration_avg: number;
      login_rate: number;
      authentication_failures: number;
    };
  };

  // 💼 비즈니스 메트릭 (신규)
  business: {
    traffic: {
      page_views: number;
      unique_visitors: number;
      bounce_rate: number;
      conversion_rate: number;
    };
    performance: {
      sla_compliance: number;
      availability: number;
      mttr_minutes: number;
      incident_count: number;
    };
    cost: {
      cpu_cost_per_hour: number;
      memory_cost_per_hour: number;
      storage_cost_per_hour: number;
      total_cost_per_hour: number;
    };
  };

  // 🌡️ 환경 컨텍스트 (신규)
  context: {
    time: {
      hour: number;
      day_of_week: number;
      is_peak_hour: boolean;
      is_maintenance_window: boolean;
    };
    external: {
      temperature: number;
      humidity: number;
      power_efficiency: number;
      cooling_cost: number;
    };
    security: {
      threat_level: number;
      failed_login_attempts: number;
      suspicious_activities: number;
      firewall_blocks: number;
    };
  };
}
