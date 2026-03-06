/**
 * Auto Report Formatters
 *
 * 보고서 다운로드를 위한 포맷터 함수들
 */

import { APP_VERSION } from '@/config/app-meta';
import type { IncidentReport } from './types';

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

${systemSummarySection}${timelineSection}${anomaliesSection}${patternSection}${recommendationsSection}---

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
${systemSummaryTxt}${timelineTxt}${anomaliesTxt}${patternTxt}
${recommendationsTxt}
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
