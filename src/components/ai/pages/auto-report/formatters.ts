/**
 * Auto Report Formatters
 *
 * 보고서 다운로드를 위한 포맷터 함수들
 * - ITIL v4 Major Incident Report 구조
 * - 탐지 방법 / 해결 절차 / 토폴로지 영향 분석 포함
 */

import { APP_VERSION } from '@/config/app-meta';
import { INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE } from '@/data/architecture-diagrams/infrastructure-topology';
import { ROLE_RESOLUTION_COMMANDS } from './formatters-commands';
import type { IncidentReport } from './types';

// ============================================================================
// 🔍 탐지 방법 (Detection) — system-rules.json 기준 임계값
// ============================================================================

const DETECTION_THRESHOLDS = {
  cpu: { warning: 80, critical: 90, unit: '%' },
  memory: { warning: 80, critical: 90, unit: '%' },
  disk: { warning: 80, critical: 90, unit: '%' },
  network: { warning: 70, critical: 85, unit: '%' },
} as const;

function buildDetectionSection(report: IncidentReport): string {
  if (!report.anomalies || report.anomalies.length === 0) return '';

  const detectedMetrics = report.anomalies.map((a) => {
    const metricKey = a.metric.toLowerCase().replace(/[^a-z]/g, '');
    const threshold =
      DETECTION_THRESHOLDS[metricKey as keyof typeof DETECTION_THRESHOLDS];
    const thresholdInfo = threshold
      ? `임계값: Warning ${threshold.warning}${threshold.unit} / Critical ${threshold.critical}${threshold.unit}`
      : '커스텀 규칙';
    const level =
      threshold && typeof a.value === 'number'
        ? a.value >= threshold.critical
          ? 'Critical'
          : a.value >= threshold.warning
            ? 'Warning'
            : 'Normal'
        : a.severity;

    return `| ${a.server_name || a.server_id} | ${a.metric} | ${typeof a.value === 'number' ? a.value.toFixed(1) : a.value} | ${level} | ${thresholdInfo} |`;
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

// ============================================================================
// 🛠️ 해결 절차 (Resolution Steps) — 서버 Role별 CLI 명령어
// ============================================================================

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
        // Data tier — distinguish DB vs Cache
        if (serverId.includes('redis') || serverId.includes('cache'))
          return 'cache';
        if (
          serverId.includes('mysql') ||
          serverId.includes('db') ||
          serverId.includes('postgres')
        )
          return 'database';
        return 'application';
      }
    }
  }
  // Fallback by server ID pattern
  if (serverId.includes('web') || serverId.includes('nginx')) return 'web';
  if (serverId.includes('api') || serverId.includes('was'))
    return 'application';
  if (serverId.includes('db') || serverId.includes('mysql')) return 'database';
  if (serverId.includes('redis') || serverId.includes('cache')) return 'cache';
  if (serverId.includes('storage') || serverId.includes('nfs'))
    return 'storage';
  if (serverId.includes('lb') || serverId.includes('haproxy'))
    return 'loadbalancer';
  return 'application';
}

function buildResolutionSection(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const roleGroups = new Map<string, string[]>();
  for (const server of report.affectedServers) {
    const role = getServerRole(server);
    const existing = roleGroups.get(role) || [];
    existing.push(server);
    roleGroups.set(role, existing);
  }

  const ROLE_LABELS: Record<string, string> = {
    web: 'Web Tier (Nginx)',
    application: 'API Tier (WAS)',
    database: 'Data Tier (MySQL)',
    cache: 'Data Tier (Redis)',
    storage: 'Storage Tier (NFS/S3)',
    loadbalancer: 'Load Balancer (HAProxy)',
  };

  const sections: string[] = [];
  for (const [role, servers] of roleGroups) {
    const commands = ROLE_RESOLUTION_COMMANDS[role];
    if (!commands) continue;

    sections.push(`### ${ROLE_LABELS[role] || role} — ${servers.map((s) => `\`${s}\``).join(', ')}

${commands
  .map(
    (c, i) => `**Step ${i + 1}: ${c.step}**
\`\`\`bash
${c.command}
\`\`\`
> ${c.description}`
  )
  .join('\n\n')}`);
  }

  if (sections.length === 0) return '';

  return `## 🔧 해결 절차 (Resolution Steps)

> 아래 절차는 영향받는 서버의 역할(Role)에 따라 자동 생성된 복구 가이드입니다.

${sections.join('\n\n---\n\n')}

`;
}

// ============================================================================
// 🌐 토폴로지 영향 분석 — infrastructure-topology.ts 기반
// ============================================================================

function buildTopologyImpactSection(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const topology = INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE;
  const connections = topology.connections || [];

  // Build adjacency: upstream (who depends on this) and downstream (what this depends on)
  const upstreamMap = new Map<string, Array<{ from: string; label: string }>>();
  const downstreamMap = new Map<string, Array<{ to: string; label: string }>>();

  for (const conn of connections) {
    // from -> to means "from" depends on "to" (from sends traffic to "to")
    const existing = downstreamMap.get(conn.from) || [];
    existing.push({ to: conn.to, label: conn.label || '' });
    downstreamMap.set(conn.from, existing);

    const upstream = upstreamMap.get(conn.to) || [];
    upstream.push({ from: conn.from, label: conn.label || '' });
    upstreamMap.set(conn.to, upstream);
  }

  // Find node label by id
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

    // Trace upstream impact (who is affected if this server goes down)
    const upstreamImpact: string[] = [];
    const visited = new Set<string>();
    const queue = [serverId];
    visited.add(serverId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const upstreams = upstreamMap.get(current) || [];
      for (const u of upstreams) {
        if (!visited.has(u.from)) {
          visited.add(u.from);
          const label = nodeLabels.get(u.from) || u.from;
          const layer = nodeLayers.get(u.from) || '';
          upstreamImpact.push(
            `  - \`${u.from}\` (${label}) — ${layer}${u.label ? ` [${u.label}]` : ''}`
          );
          queue.push(u.from);
        }
      }
    }

    // Trace downstream dependencies (what this server depends on)
    const downstreamDeps: string[] = [];
    const visitedDown = new Set<string>();
    visitedDown.add(serverId);
    const downQueue = [serverId];

    while (downQueue.length > 0) {
      const current = downQueue.shift()!;
      const downstreams = downstreamMap.get(current) || [];
      for (const d of downstreams) {
        if (!visitedDown.has(d.to)) {
          visitedDown.add(d.to);
          const label = nodeLabels.get(d.to) || d.to;
          const layer = nodeLayers.get(d.to) || '';
          downstreamDeps.push(
            `  - \`${d.to}\` (${label}) — ${layer}${d.label ? ` [${d.label}]` : ''}`
          );
          downQueue.push(d.to);
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

/**
 * 심각도 한글 매핑
 */
const SEVERITY_KO: Record<string, string> = {
  critical: '🔴 긴급',
  high: '🟠 높음',
  warning: '🟡 경고',
  medium: '🟡 보통',
  low: '🟢 낮음',
  info: '🔵 정보',
};

/**
 * 상태 한글 매핑
 */
const STATUS_KO: Record<string, string> = {
  active: '🔴 진행 중',
  investigating: '🟡 조사 중',
  resolved: '🟢 해결됨',
};

/**
 * 마크다운 형식 보고서 생성
 */
export function formatReportAsMarkdown(report: IncidentReport): string {
  const timestamp =
    report.timestamp instanceof Date
      ? report.timestamp.toLocaleString('ko-KR')
      : new Date().toLocaleString('ko-KR');
  const reportId = report.id || `report-${Date.now()}`;
  const severityKo = SEVERITY_KO[report.severity] || report.severity;
  const statusKo = STATUS_KO[report.status] || report.status;

  // 시스템 요약 섹션
  const systemSummarySection = report.systemSummary
    ? `## 📊 시스템 영향 분석

| 구분 | 서버 수 |
|------|---------|
| 전체 서버 | ${report.systemSummary.totalServers}대 |
| 정상 | ${report.systemSummary.healthyServers}대 |
| 경고 | ${report.systemSummary.warningServers}대 |
| 위험 | ${report.systemSummary.criticalServers}대 |

**영향도**: 전체 인프라의 ${report.systemSummary.totalServers > 0 ? Math.round(((report.systemSummary.warningServers + report.systemSummary.criticalServers) / report.systemSummary.totalServers) * 100) : 0}%가 영향받음

`
    : '';

  // 타임라인 섹션
  const timelineSection =
    report.timeline && report.timeline.length > 0
      ? `## ⏱️ 이벤트 타임라인

| 시간 | 이벤트 | 심각도 |
|------|--------|--------|
${report.timeline.map((t) => `| ${t.timestamp} | ${t.event} | ${t.severity} |`).join('\n')}

`
      : '';

  // 이상 감지 상세 섹션
  const anomaliesSection =
    report.anomalies && report.anomalies.length > 0
      ? `## 🔍 이상 감지 상세

| 서버 | 메트릭 | 값 | 심각도 |
|------|--------|-----|--------|
${report.anomalies.map((a) => `| ${a.server_name || a.server_id} | ${a.metric} | ${typeof a.value === 'number' ? a.value.toFixed(1) : a.value} | ${a.severity} |`).join('\n')}

`
      : '';

  // 권장 조치 섹션
  const recommendationsSection =
    report.recommendations && report.recommendations.length > 0
      ? `## 🛠️ 권장 조치 및 복구 계획

${report.recommendations
  .map(
    (r, i) => `### ${i + 1}. ${r.action}
- **우선순위**: ${r.priority}
- **예상 효과**: ${r.expected_impact}`
  )
  .join('\n\n')}

## 🛡️ 재발 방지 대책

${
  report.recommendations
    .filter((r) => r.priority === 'high' || r.priority === '높음')
    .map((r, i) => `${i + 1}. ${r.action} - 정기 점검 항목에 추가`)
    .join('\n') || '- 모니터링 임계값 재검토\n- 알림 규칙 최적화'
}

`
      : '';

  // 패턴 섹션
  const patternSection = report.pattern
    ? `## 🔬 근본 원인 분석 (RCA)

### 감지된 패턴

${report.pattern}

`
    : '';

  return `# 📋 ${report.title || '장애 보고서'}

> **보고서 ID**: \`${reportId}\` | **생성 시각**: ${timestamp}

---

## 📌 요약 (Executive Summary)

| 항목 | 내용 |
|------|------|
| **심각도** | ${severityKo} |
| **현재 상태** | ${statusKo} |
| **발생 시간** | ${timestamp} |
| **영향 서버** | ${report.affectedServers.length}대 |
| **영향도** | ${report.systemSummary ? `전체 인프라의 ${report.systemSummary.totalServers > 0 ? Math.round(((report.systemSummary.warningServers + report.systemSummary.criticalServers) / report.systemSummary.totalServers) * 100) : 0}%` : 'N/A'} |

### 상황 개요

${report.description}

---

## 🖥️ 영향 범위

### 영향받는 서버 (${report.affectedServers.length}대)

${report.affectedServers.length > 0 ? report.affectedServers.map((s) => `- \`${s}\``).join('\n') : '- 없음'}

${systemSummarySection}${timelineSection}${anomaliesSection}${buildDetectionSection(report)}${patternSection}${recommendationsSection}${buildResolutionSection(report)}${buildTopologyImpactSection(report)}---

## 📎 부록

| 항목 | 내용 |
|------|------|
| **보고서 생성** | OpenManager AI Engine |
| **분석 기준** | 실시간 메트릭 + AI 패턴 분석 |
| **참조 표준** | ITIL v4 Major Incident Management |

---
*자동 생성 — OpenManager AI*
*${timestamp}*
`;
}

// ============================================================================
// TXT 포맷용 헬퍼 함수들
// ============================================================================

function buildDetectionSectionText(report: IncidentReport): string {
  if (!report.anomalies || report.anomalies.length === 0) return '';

  const lines = report.anomalies.map((a) => {
    const metricKey = a.metric.toLowerCase().replace(/[^a-z]/g, '');
    const threshold =
      DETECTION_THRESHOLDS[metricKey as keyof typeof DETECTION_THRESHOLDS];
    const level =
      threshold && typeof a.value === 'number'
        ? a.value >= threshold.critical
          ? 'Critical'
          : a.value >= threshold.warning
            ? 'Warning'
            : 'Normal'
        : a.severity;
    return `- ${a.server_name || a.server_id}: ${a.metric} = ${typeof a.value === 'number' ? a.value.toFixed(1) : a.value} → ${level}`;
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

function buildResolutionSectionText(report: IncidentReport): string {
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
      `[${role.toUpperCase()}] ${servers.join(', ')}\n${commands.map((c, i) => `  ${i + 1}. ${c.step}: ${c.command}`).join('\n')}`
    );
  }

  if (sections.length === 0) return '';
  return `해결 절차
---------
${sections.join('\n\n')}
`;
}

function buildTopologyImpactSectionText(report: IncidentReport): string {
  if (!report.affectedServers || report.affectedServers.length === 0) return '';

  const topology = INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE;
  const connections = topology.connections || [];

  const upstreamMap = new Map<string, Array<{ from: string; label: string }>>();
  for (const conn of connections) {
    const upstream = upstreamMap.get(conn.to) || [];
    upstream.push({ from: conn.from, label: conn.label || '' });
    upstreamMap.set(conn.to, upstream);
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
      for (const u of upstreams) {
        if (!visited.has(u.from)) {
          visited.add(u.from);
          impacted.push(`  → ${u.from} (${nodeLabels.get(u.from) || u.from})`);
          queue.push(u.from);
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

/**
 * 텍스트 형식 보고서 생성
 */
export function formatReportAsText(report: IncidentReport): string {
  const timestamp =
    report.timestamp instanceof Date
      ? report.timestamp.toLocaleString('ko-KR')
      : new Date().toLocaleString('ko-KR');
  const reportId = report.id || `report-${Date.now()}`;
  const titleText = report.title || '장애 보고서';

  // 시스템 요약 (TXT)
  const systemSummaryTxt = report.systemSummary
    ? `
시스템 영향 분석
----------------
전체 서버: ${report.systemSummary.totalServers}대
정상: ${report.systemSummary.healthyServers}대
경고: ${report.systemSummary.warningServers}대
위험: ${report.systemSummary.criticalServers}대
`
    : '';

  // 타임라인 (TXT)
  const timelineTxt =
    report.timeline && report.timeline.length > 0
      ? `
이벤트 타임라인
---------------
${report.timeline.map((t) => `[${t.timestamp}] ${t.event} (${t.severity})`).join('\n')}
`
      : '';

  // 이상 감지 (TXT)
  const anomaliesTxt =
    report.anomalies && report.anomalies.length > 0
      ? `
이상 감지 상세
--------------
${report.anomalies.map((a) => `- ${a.server_name || a.server_id}: ${a.metric} = ${typeof a.value === 'number' ? a.value.toFixed(1) : a.value} (${a.severity})`).join('\n')}
`
      : '';

  // 패턴 (TXT)
  const patternTxt = report.pattern
    ? `근본 원인 분석
--------------
${report.pattern}
`
    : '';

  // 권장 조치 (TXT)
  const recommendationsTxt =
    report.recommendations && report.recommendations.length > 0
      ? `권장 조치 및 복구 계획
----------------------
${report.recommendations.map((r, i) => `${i + 1}. ${r.action}\n   - 우선순위: ${r.priority}\n   - 예상 효과: ${r.expected_impact}`).join('\n\n')}
`
      : '';

  return `${titleText}
${'='.repeat(titleText.length)}

[요약]
보고서 ID: ${reportId}
심각도: ${report.severity}
상태: ${report.status}
생성 시간: ${timestamp}
영향 서버: ${report.affectedServers.length}대

설명
----
${report.description}

영향받는 서버
------------
${report.affectedServers.length > 0 ? report.affectedServers.join(', ') : '없음'}
${systemSummaryTxt}${timelineTxt}${anomaliesTxt}${buildDetectionSectionText(report)}${patternTxt}
${recommendationsTxt}${buildResolutionSectionText(report)}${buildTopologyImpactSectionText(report)}
---
자동 생성된 장애 보고서 - OpenManager AI v${APP_VERSION}
문서 형식: ITIL Major Incident Report Template
`;
}

/**
 * 보고서를 마크다운으로 클립보드에 복사
 */
export async function copyReportAsMarkdown(
  report: IncidentReport
): Promise<boolean> {
  try {
    const content = formatReportAsMarkdown(report);
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * 보고서 다운로드 실행
 */
export function downloadReport(
  report: IncidentReport,
  format: 'md' | 'txt'
): void {
  const reportId = report.id || `report-${Date.now()}`;
  const content =
    format === 'md'
      ? formatReportAsMarkdown(report)
      : formatReportAsText(report);
  const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `incident-report-${reportId.slice(0, 8)}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
