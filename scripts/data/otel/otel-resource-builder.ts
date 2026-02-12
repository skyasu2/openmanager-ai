/**
 * OTel Resource Builder
 *
 * Prometheus labels + nodeInfo → OTel Resource Attributes 변환.
 * OpenTelemetry Semantic Conventions v1.27 기준.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/resource/host/
 * @created 2026-02-11
 */

import type {
  OTelResourceAttributes,
  OTelResourceCatalog,
  PrometheusLabels,
  PrometheusNodeInfo,
  PrometheusTarget,
} from './types';

// ============================================================================
// Resource Attribute Builder
// ============================================================================

/**
 * 단일 서버의 Prometheus labels → OTel Resource Attributes 변환
 */
export function buildResourceAttributes(
  serverId: string,
  labels: PrometheusLabels,
  nodeInfo?: PrometheusNodeInfo
): OTelResourceAttributes {
  const attrs: OTelResourceAttributes = {
    'service.name': 'openmanager-ai',
    'host.name': labels.hostname,
    'host.id': serverId,
    'host.type': labels.server_type,
    'os.type': labels.os,
    'os.description': `${labels.os} ${labels.os_version}`,
    'cloud.region': 'kr-seoul',
    'cloud.availability_zone': labels.datacenter,
    'deployment.environment': labels.environment,
  };

  if (nodeInfo) {
    attrs['host.cpu.count'] = nodeInfo.cpu_cores;
    attrs['host.memory.size'] = nodeInfo.memory_total_bytes;
    attrs['host.disk.size'] = nodeInfo.disk_total_bytes;
  }

  return attrs;
}

/**
 * 전체 서버 목록 → OTel Resource Catalog 생성
 */
export function buildResourceCatalog(
  targets: Record<string, PrometheusTarget>
): OTelResourceCatalog {
  const resources: Record<string, OTelResourceAttributes> = {};

  for (const [instanceKey, target] of Object.entries(targets)) {
    const serverId = instanceKey.replace(/:9100$/, '');
    resources[serverId] = buildResourceAttributes(
      serverId,
      target.labels,
      target.nodeInfo
    );
  }

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    resources,
  };
}
