/**
 * Auto Report formatter sections
 * Extracted from formatters.ts to keep the top-level formatter focused.
 */

import { INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE } from '@/data/architecture-diagrams/infrastructure-topology';
import { ROLE_RESOLUTION_COMMANDS } from './formatters-commands';
import type { IncidentReport } from './types';

const DETECTION_THRESHOLDS = {
  cpu: { warning: 80, critical: 90, unit: '%' },
  memory: { warning: 80, critical: 90, unit: '%' },
  disk: { warning: 80, critical: 90, unit: '%' },
  network: { warning: 70, critical: 85, unit: '%' },
} as const;

const ROLE_LABELS: Record<string, string> = {
  web: 'Web Tier (Nginx)',
  application: 'API Tier (WAS)',
  database: 'Data Tier (MySQL)',
  cache: 'Data Tier (Redis)',
  storage: 'Storage Tier (NFS/S3)',
  loadbalancer: 'Load Balancer (HAProxy)',
};

function getServerRole(serverId: string): string {
  const topology = INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE;
  for (const layer of topology.layers) {
    for (const node of layer.nodes) {
      if (node.id === serverId) {
        const title = layer.title.toLowerCase();
        if (title.includes('load balancer')) return 'loadbalancer';
        if (title.includes('web')) return 'web';
        if (title.includes('api')) return 'application';
        if (title.includes('storage')) return 'storage';
        if (serverId.includes('redis') || serverId.includes('cache')) {
          return 'cache';
        }
        if (
          serverId.includes('mysql') ||
          serverId.includes('db') ||
          serverId.includes('postgres')
        ) {
          return 'database';
        }
        return 'application';
      }
    }
  }

  if (serverId.includes('web') || serverId.includes('nginx')) return 'web';
  if (serverId.includes('api') || serverId.includes('was')) {
    return 'application';
  }
  if (serverId.includes('db') || serverId.includes('mysql')) return 'database';
  if (serverId.includes('redis') || serverId.includes('cache')) return 'cache';
  if (serverId.includes('storage') || serverId.includes('nfs')) {
    return 'storage';
  }
  if (serverId.includes('lb') || serverId.includes('haproxy')) {
    return 'loadbalancer';
  }
  return 'application';
}

export function buildDetectionSection(report: IncidentReport): string {
  if (!report.anomalies || report.anomalies.length === 0) return '';

  const detectedMetrics = report.anomalies.map((anomaly) => {
    const metricKey = anomaly.metric.toLowerCase().replace(/[^a-z]/g, '');
    const threshold =
      DETECTION_THRESHOLDS[metricKey as keyof typeof DETECTION_THRESHOLDS];
    const thresholdInfo = threshold
      ? `임계값: Warning ${threshold.warning}${threshold.unit} / Critical ${threshold.critical}${threshold.unit}`
      : '커스텀 규칙';
    const level =
      threshold && typeof anomaly.value === 'number'
        ? anomaly.value >= threshold.critical
          ? 'Critical'
          : anomaly.value >= threshold.warning
            ? 'Warning'
            : 'Normal'
        : anomaly.severity;

    return `| ${anomaly.server_name || anomaly.server_id} | ${anomaly.metric} | ${typeof anomaly.value === 'number' ? anomaly.value.toFixed(1) : anomaly.value} | ${level} | ${thresholdInfo} |`;
  });

  return `## 🔍 탐지 방법 (Detection)

### 감지 방식
- **모니터링**: OpenTelemetry 기반 메트릭 수집 (10분 간격)
- **분석 엔진**: AI 패턴 분석 + 임계값 기반 이상 탐지
- **감지 시점**: ${report.timestamp instanceof Date ? report.timestamp.toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR')}

### 적용 임계값 (system-rules.json)

| 메트릭 | Warning | Critical | 비고 |
|--------|:-------:|:--------:|------|
| CPU | 80% | 90% | 5분 이상 지속 시 alert |
| Memory | 80% | 90% | OOM 위험 사전 경고 |
| Disk | 80% | 90% | 여유 10% 확보 기준 |
| Network | 70% | 85% | 1Gbps 기준 대역폭 |

### 감지된 이상 항목

| 서버 | 메트릭 | 측정값 | 판정 | 기준 |
|------|--------|--------|------|------|
${detectedMetrics.join('\n')}

`;
}

export function buildResolutionSection(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const roleGroups = new Map<string, string[]>();
  for (const server of report.affectedServers) {
    const role = getServerRole(server);
    const existing = roleGroups.get(role) || [];
    existing.push(server);
    roleGroups.set(role, existing);
  }

  const sections: string[] = [];
  for (const [role, servers] of roleGroups) {
    const commands = ROLE_RESOLUTION_COMMANDS[role];
    if (!commands) continue;

    sections.push(`### ${ROLE_LABELS[role] || role} — ${servers.map((server) => `\`${server}\``).join(', ')}

${commands
  .map(
    (command, index) => `**Step ${index + 1}: ${command.step}**
\`\`\`bash
${command.command}
\`\`\`
> ${command.description}`
  )
  .join('\n\n')}`);
  }

  if (sections.length === 0) return '';

  return `## 🔧 해결 절차 (Resolution Steps)

> 아래 절차는 영향받는 서버의 역할(Role)에 따라 자동 생성된 복구 가이드입니다.

${sections.join('\n\n---\n\n')}

`;
}

export function buildTopologyImpactSection(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const topology = INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE;
  const connections = topology.connections || [];
  const upstreamMap = new Map<string, Array<{ from: string; label: string }>>();
  const downstreamMap = new Map<string, Array<{ to: string; label: string }>>();

  for (const connection of connections) {
    const existing = downstreamMap.get(connection.from) || [];
    existing.push({ to: connection.to, label: connection.label || '' });
    downstreamMap.set(connection.from, existing);

    const upstream = upstreamMap.get(connection.to) || [];
    upstream.push({ from: connection.from, label: connection.label || '' });
    upstreamMap.set(connection.to, upstream);
  }

  const nodeLabels = new Map<string, string>();
  const nodeLayers = new Map<string, string>();
  for (const layer of topology.layers) {
    for (const node of layer.nodes) {
      nodeLabels.set(node.id, node.label);
      nodeLayers.set(node.id, layer.title);
    }
  }

  const impactChains: string[] = [];

  for (const serverId of report.affectedServers) {
    const serverLabel = nodeLabels.get(serverId) || serverId;
    const serverLayer = nodeLayers.get(serverId) || '알 수 없음';
    const upstreamImpact: string[] = [];
    const visited = new Set<string>();
    const queue = [serverId];
    visited.add(serverId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const upstreams = upstreamMap.get(current) || [];
      for (const upstream of upstreams) {
        if (!visited.has(upstream.from)) {
          visited.add(upstream.from);
          const label = nodeLabels.get(upstream.from) || upstream.from;
          const layer = nodeLayers.get(upstream.from) || '';
          upstreamImpact.push(
            `  - \`${upstream.from}\` (${label}) — ${layer}${upstream.label ? ` [${upstream.label}]` : ''}`
          );
          queue.push(upstream.from);
        }
      }
    }

    const downstreamDeps: string[] = [];
    const visitedDown = new Set<string>();
    visitedDown.add(serverId);
    const downQueue = [serverId];

    while (downQueue.length > 0) {
      const current = downQueue.shift()!;
      const downstreams = downstreamMap.get(current) || [];
      for (const downstream of downstreams) {
        if (!visitedDown.has(downstream.to)) {
          visitedDown.add(downstream.to);
          const label = nodeLabels.get(downstream.to) || downstream.to;
          const layer = nodeLayers.get(downstream.to) || '';
          downstreamDeps.push(
            `  - \`${downstream.to}\` (${label}) — ${layer}${downstream.label ? ` [${downstream.label}]` : ''}`
          );
          downQueue.push(downstream.to);
        }
      }
    }

    let chain = `### \`${serverId}\` — ${serverLabel} (${serverLayer})\n`;
    if (upstreamImpact.length > 0) {
      chain += `\n**영향받는 상위 계층** (이 서버 장애 시 영향):\n${upstreamImpact.join('\n')}\n`;
    } else {
      chain += '\n**영향받는 상위 계층**: 없음 (최상위 노드)\n';
    }
    if (downstreamDeps.length > 0) {
      chain += `\n**의존하는 하위 계층** (이 서버가 의존):\n${downstreamDeps.join('\n')}\n`;
    } else {
      chain += '\n**의존하는 하위 계층**: 없음 (최하위 노드)\n';
    }

    impactChains.push(chain);
  }

  if (impactChains.length === 0) return '';

  return `## 🌐 토폴로지 영향 분석

> 인프라 토폴로지 기반 의존성 체인 분석. 장애 서버의 상위/하위 영향 범위를 추적합니다.
> 토폴로지: ${topology.description}

${impactChains.join('\n---\n\n')}

`;
}

export function buildDetectionSectionText(report: IncidentReport): string {
  if (!report.anomalies || report.anomalies.length === 0) return '';

  const lines = report.anomalies.map((anomaly) => {
    const metricKey = anomaly.metric.toLowerCase().replace(/[^a-z]/g, '');
    const threshold =
      DETECTION_THRESHOLDS[metricKey as keyof typeof DETECTION_THRESHOLDS];
    const level =
      threshold && typeof anomaly.value === 'number'
        ? anomaly.value >= threshold.critical
          ? 'Critical'
          : anomaly.value >= threshold.warning
            ? 'Warning'
            : 'Normal'
        : anomaly.severity;
    return `- ${anomaly.server_name || anomaly.server_id}: ${anomaly.metric} = ${typeof anomaly.value === 'number' ? anomaly.value.toFixed(1) : anomaly.value} → ${level}`;
  });

  return `
탐지 방법
---------
감지 방식: OTel 메트릭 수집 (10분 간격) + AI 패턴 분석
임계값: CPU/Memory/Disk Warning=80% Critical=90%, Network Warning=70% Critical=85%
감지 항목:
${lines.join('\n')}
`;
}

export function buildResolutionSectionText(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const roleGroups = new Map<string, string[]>();
  for (const server of report.affectedServers) {
    const role = getServerRole(server);
    const existing = roleGroups.get(role) || [];
    existing.push(server);
    roleGroups.set(role, existing);
  }

  const sections: string[] = [];
  for (const [role, servers] of roleGroups) {
    const commands = ROLE_RESOLUTION_COMMANDS[role];
    if (!commands) continue;
    sections.push(
      `[${role.toUpperCase()}] ${servers.join(', ')}\n${commands.map((command, index) => `  ${index + 1}. ${command.step}: ${command.command}`).join('\n')}`
    );
  }

  if (sections.length === 0) return '';
  return `해결 절차
---------
${sections.join('\n\n')}
`;
}

export function buildTopologyImpactSectionText(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const topology = INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE;
  const connections = topology.connections || [];
  const upstreamMap = new Map<string, Array<{ from: string; label: string }>>();

  for (const connection of connections) {
    const upstream = upstreamMap.get(connection.to) || [];
    upstream.push({ from: connection.from, label: connection.label || '' });
    upstreamMap.set(connection.to, upstream);
  }

  const nodeLabels = new Map<string, string>();
  for (const layer of topology.layers) {
    for (const node of layer.nodes) {
      nodeLabels.set(node.id, node.label);
    }
  }

  const chains: string[] = [];
  for (const serverId of report.affectedServers) {
    const visited = new Set<string>();
    const queue = [serverId];
    visited.add(serverId);
    const impacted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const upstreams = upstreamMap.get(current) || [];
      for (const upstream of upstreams) {
        if (!visited.has(upstream.from)) {
          visited.add(upstream.from);
          impacted.push(
            `  → ${upstream.from} (${nodeLabels.get(upstream.from) || upstream.from})`
          );
          queue.push(upstream.from);
        }
      }
    }

    if (impacted.length > 0) {
      chains.push(
        `${serverId} (${nodeLabels.get(serverId) || serverId}) 장애 시 영향:\n${impacted.join('\n')}`
      );
    }
  }

  if (chains.length === 0) return '';
  return `토폴로지 영향 분석
------------------
${chains.join('\n\n')}
`;
}
