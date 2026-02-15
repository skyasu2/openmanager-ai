/**
 * MonitoringContext - 모니터링 파이프라인 통합
 *
 * AlertManager + MetricsAggregator + HealthCalculator → AI/Dashboard 출력
 * 런타임 계산 (15서버 집계 <1ms, Edge Runtime 호환)
 *
 * @created 2026-02-04
 * @updated 2026-02-15 - OTel-native SSOT 전환 (getHourlyData → getOTelHourlyData)
 */

import { getOTelHourlyData, getOTelResourceCatalog } from '@/data/otel-data';
import { executePromQL } from '@/lib/promql/promql-engine';
import {
  getKSTMinuteOfDay,
  getKSTTimestamp,
  MetricsProvider,
} from '@/services/metrics/MetricsProvider';
import type { OTelHourlyFile } from '@/types/otel-metrics';
import type { PromQLResult } from '@/types/processed-metrics';
import { type Alert, AlertManager } from './AlertManager';
import { HealthCalculator, type HealthReport } from './HealthCalculator';
import { type AggregatedMetrics, MetricsAggregator } from './MetricsAggregator';

export type MonitoringReport = {
  timestamp: string;
  health: HealthReport;
  aggregated: AggregatedMetrics;
  firingAlerts: Alert[];
};

export class MonitoringContext {
  private alertManager = new AlertManager();
  private aggregator = new MetricsAggregator();
  private healthCalc = new HealthCalculator();

  private static instance: MonitoringContext;

  private constructor() {}

  public static getInstance(): MonitoringContext {
    if (!MonitoringContext.instance) {
      MonitoringContext.instance = new MonitoringContext();
    }
    return MonitoringContext.instance;
  }

  /**
   * 분석 실행: 런타임 계산 (15서버 집계 <1ms)
   */
  analyze(): MonitoringReport {
    const timestamp = getKSTTimestamp();
    const provider = MetricsProvider.getInstance();
    const allMetrics = provider.getAllServerMetrics();

    // 1. Alert 평가
    const firingAlerts = this.alertManager.evaluate(allMetrics, timestamp);

    // 2. 집계
    const aggregated = this.aggregator.aggregate(allMetrics);

    // 3. 건강도 계산
    const health = this.healthCalc.calculate(aggregated, firingAlerts);

    return { timestamp, health, aggregated, firingAlerts };
  }

  /**
   * AI용 LLM 컨텍스트 (~100 토큰)
   */
  getLLMContext(): string {
    const report = this.analyze();
    const { health, aggregated, firingAlerts, timestamp } = report;

    // 타임스탬프 → KST 시간 표시
    const timeStr = timestamp
      .replace(/T/, ' ')
      .replace(/\.\d+/, '')
      .replace(/\+09:00/, ' KST');

    let ctx = `[Monitoring Report - ${timeStr}]\n`;
    ctx += `System Health: ${health.score}/100 (${health.grade})\n`;
    ctx += `Scrape: node-exporter | ${aggregated.statusCounts.total} targets, ${aggregated.statusCounts.online} UP\n\n`;

    // Active Alerts
    if (firingAlerts.length > 0) {
      ctx += `Active Alerts (${firingAlerts.length}):\n`;
      const sorted = [...firingAlerts].sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return b.value - a.value;
      });
      for (const alert of sorted.slice(0, 5)) {
        const durMin = Math.round(alert.duration / 60);
        ctx += `- ${alert.instance} ${alert.metric}=${alert.value}% [${alert.severity.toUpperCase()}, firing ${durMin}m]\n`;
      }
      ctx += '\n';
    }

    // By Type
    ctx += 'By Type: ';
    ctx += aggregated.byServerType
      .map((t) => `${t.serverType}(${t.count}) avg CPU ${t.avgCpu}%`)
      .join(' | ');
    ctx += '\n';

    // Top CPU
    if (aggregated.topCpu.length > 0) {
      ctx += 'Top CPU: ';
      ctx += aggregated.topCpu
        .slice(0, 3)
        .map((t) => `${t.instance}(${t.value}%)`)
        .join(', ');
      ctx += '\n';
    }

    // OTel Resource Context
    ctx += this.buildOTelResourceContext();

    return ctx;
  }

  /**
   * OTel Resource 메타데이터 컨텍스트 생성
   */
  private buildOTelResourceContext(): string {
    try {
      const catalog = getOTelResourceCatalog();
      const resources = Object.values(catalog.resources);
      if (resources.length === 0) return '';

      // 서버 타입별 집계
      const typeCounts = new Map<string, number>();
      const zones = new Set<string>();
      for (const r of resources) {
        const type = r['host.type'];
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        zones.add(r['cloud.availability_zone']);
      }

      let ctx = '\n[OTel Resource Context]\n';
      ctx += `Schema: OpenTelemetry Semantic Conventions v1.27\n`;
      ctx += `Hosts: ${resources.length} (${Array.from(typeCounts.entries())
        .map(([t, c]) => `${t}:${c}`)
        .join(', ')})\n`;
      ctx += `Zones: ${Array.from(zones).join(', ')}\n`;
      ctx += `Metric Schema (OTel → PromQL alias):\n`;
      ctx += `  system.cpu.utilization (alias: node_cpu_usage_percent), ratio 0-1\n`;
      ctx += `  system.memory.utilization (alias: node_memory_usage_percent), ratio 0-1\n`;
      ctx += `  system.filesystem.utilization (alias: node_filesystem_usage_percent), ratio 0-1\n`;
      ctx += `  system.network.io (alias: node_network_transmit_bytes_rate), By/s\n`;
      ctx += `Query: Both OTel and Prometheus names accepted in queryMetric()\n`;

      return ctx;
    } catch {
      return '';
    }
  }

  /**
   * PromQL 스타일 내부 쿼리 실행
   *
   * @example
   *   queryMetric('node_cpu_usage_percent{server_type="web"}')
   *   queryMetric('avg(node_cpu_usage_percent) by (server_type)')
   *   queryMetric('up == 0')
   *   queryMetric('rate(node_cpu_usage_percent[1h])')
   */
  queryMetric(promql: string): PromQLResult {
    const minuteOfDay = getKSTMinuteOfDay();
    const currentHour = Math.floor(minuteOfDay / 60);
    const slotIndex = Math.floor((minuteOfDay % 60) / 10);

    const hourlyFile = getOTelHourlyData(currentHour);
    if (!hourlyFile) {
      return { resultType: 'vector', result: [] };
    }

    // rate() 쿼리를 위한 전체 시간대 맵
    const hourlyFileMap = new Map<number, OTelHourlyFile>();
    for (let h = 0; h < 24; h++) {
      const data = getOTelHourlyData(h);
      if (data) hourlyFileMap.set(h, data);
    }

    return executePromQL(
      promql,
      hourlyFile,
      hourlyFileMap,
      currentHour,
      slotIndex
    );
  }

  /**
   * Alert 이력 조회: firing + resolved
   */
  getAlertHistory(): { firing: Alert[]; resolved: Alert[] } {
    return this.alertManager.getAllAlerts();
  }

  /**
   * Dashboard 요약
   */
  getDashboardSummary(): {
    healthScore: number;
    healthGrade: string;
    statusCounts: MonitoringReport['aggregated']['statusCounts'];
    firingAlertCount: number;
    criticalAlertCount: number;
    avgCpu: number;
    avgMemory: number;
  } {
    const report = this.analyze();
    return {
      healthScore: report.health.score,
      healthGrade: report.health.grade,
      statusCounts: report.aggregated.statusCounts,
      firingAlertCount: report.firingAlerts.length,
      criticalAlertCount: report.firingAlerts.filter(
        (a) => a.severity === 'critical'
      ).length,
      avgCpu: report.aggregated.avgCpu,
      avgMemory: report.aggregated.avgMemory,
    };
  }
}
