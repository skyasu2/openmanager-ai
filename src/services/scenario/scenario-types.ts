/**
 * Type definitions and interfaces for the scenario data system.
 *
 * @see scenario-loader.ts - Main orchestration facade
 */

// Enhanced Server Metrics 인터페이스 (route.ts와 동기화 필요)
export interface EnhancedServerMetrics {
  id: string;
  name: string;
  hostname: string;
  status:
    | 'online'
    | 'offline'
    | 'warning'
    | 'critical'
    | 'maintenance'
    | 'unknown';
  cpu: number;
  cpu_usage: number;
  memory: number;
  memory_usage: number;
  disk: number;
  disk_usage: number;
  network: number;
  network_in: number;
  network_out: number;
  uptime: number;
  responseTime: number;
  last_updated: string;
  location: string;
  alerts: never[]; // 항상 빈 배열
  ip: string;
  os: string;
  type: string;
  role: string;
  environment: string;
  provider: string;
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    network_speed: string;
  };
  lastUpdate: string;
  services: unknown[]; // 외부 데이터, 런타임에서 검증됨
  systemInfo: {
    os: string;
    uptime: string;
    processes: number;
    zombieProcesses: number;
    loadAverage: string;
    lastUpdate: string;
  };
  networkInfo: {
    interface: string;
    receivedBytes: string;
    sentBytes: string;
    receivedErrors: number;
    sentErrors: number;
    status:
      | 'online'
      | 'offline'
      | 'warning'
      | 'critical'
      | 'maintenance'
      | 'unknown';
  };
}

/**
 * JSON 파일 데이터 구조 (sync 스크립트와 동기화)
 */
export interface HourlyJsonData {
  hour: number;
  scrapeConfig: {
    scrapeInterval: string;
    evaluationInterval: string;
    source: string;
  };
  _scenario?: string;
  dataPoints: Array<{
    timestampMs: number;
    targets: Record<string, PrometheusTargetData>;
  }>;
  metadata: {
    version: string;
    format: string;
    totalDataPoints: number;
    intervalMinutes: number;
    serverCount: number;
    affectedServers: number;
  };
}

export interface PrometheusTargetData {
  job: string;
  instance: string;
  labels: {
    hostname: string;
    datacenter: string;
    environment: string;
    server_type: string;
    os: string;
    os_version: string;
  };
  metrics: {
    up: 0 | 1;
    node_cpu_usage_percent: number;
    node_memory_usage_percent: number;
    node_filesystem_usage_percent: number;
    node_network_transmit_bytes_rate: number;
    node_load1: number;
    node_load5: number;
    node_boot_time_seconds: number;
    node_procs_running: number;
    node_http_request_duration_milliseconds: number;
  };
  nodeInfo: {
    cpu_cores: number;
    memory_total_bytes: number;
    disk_total_bytes: number;
  };
  logs: string[];
}

export interface RawServerData {
  id: string;
  name: string;
  hostname: string;
  type: string;
  location: string;
  environment: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  responseTime: number;
  uptime: number;
  ip: string;
  os: string;
  specs: {
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
  };
  services: string[];
  processes: number;
}

/** Log entry returned by generateScenarioLogs */
export type ScenarioLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
};
