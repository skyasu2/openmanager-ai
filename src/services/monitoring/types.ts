/**
 * ProcessedServerData - internal intermediate type
 *
 * MetricsProvider(ApiServerMetrics) -> processMetric() -> ProcessedServerData
 * -> projection -> Server | EnhancedServerMetrics | PaginatedServer
 *
 * Field categories:
 *   SOURCE   - Direct from hourly-data JSON (Prometheus)
 *   DERIVED  - Mathematically derived from source metrics
 *   CONFIG   - From configuration mapping (server-services-map)
 *   OPTIONAL - Present only when source metric exists (no fallback fabrication)
 */

import type { ServiceStatus } from '@/types/common';

export interface ProcessedServerData {
  // ── SOURCE: Identity (from Prometheus labels) ──────────────────
  id: string;
  name: string;
  hostname: string;
  serverType: string;
  environment: string;
  location: string;
  timestamp: string;
  minuteOfDay: number;

  // ── CONFIG: Server Registry (administrator-entered IP address) ──
  ip: string | undefined;

  // ── SOURCE: Raw metrics (from Prometheus metrics) ──────────────
  cpu: number;
  memory: number;
  disk: number;
  network: number;

  // ── DERIVED: Status (from system-rules.json thresholds) ────────
  status: 'online' | 'warning' | 'critical' | 'offline';

  // ── SOURCE: OS info (from Prometheus labels) ───────────────────
  osLabel: string;

  // ── DERIVED: Uptime (from node_boot_time_seconds) ──────────────
  uptimeSeconds: number;

  // ── SOURCE: Load averages (from Prometheus) ────────────────────
  loadAvg1: number;
  loadAvg5: number;
  // ── DERIVED: Load 15 estimated via EMA from load1/load5 ────────
  loadAvg15: number;

  // ── DERIVED: Network split (from transmit_rate × server-type ratio)
  networkIn: number;
  networkOut: number;

  // ── SOURCE (optional): Only present when Prometheus has the metric
  procsRunning: number | undefined;
  responseTimeMs: number | undefined;

  // ── SOURCE (optional): Hardware info from Prometheus nodeInfo ───
  specs:
    | {
        cpu_cores: number;
        memory_gb: number;
        disk_gb: number;
      }
    | undefined;

  // ── CONFIG: Services inferred from hostname + serverType ───────
  services: Array<{ name: string; status: ServiceStatus; port: number }>;

  // ── DERIVED: Alerts extracted from real logs ───────────────────
  alerts: Array<{
    id: string;
    server_id: string;
    type: 'cpu' | 'memory' | 'disk' | 'network' | 'custom';
    message: string;
    severity: 'critical' | 'warning';
    timestamp: string;
    resolved: boolean;
  }>;

  // ── SOURCE: Raw logs from Prometheus ───────────────────────────
  logs: string[];
}
