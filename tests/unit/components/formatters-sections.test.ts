/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  buildDetectionSection,
  buildDetectionSectionText,
  buildResolutionSection,
  buildResolutionSectionText,
  buildTopologyImpactSection,
  buildTopologyImpactSectionText,
} from '../../../src/components/ai/pages/auto-report/formatters-sections';
import type { IncidentReport } from '../../../src/components/ai/pages/auto-report/types';

function createReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: 'report-1',
    title: 'DB latency incident',
    severity: 'critical',
    timestamp: new Date('2026-03-29T00:00:00Z'),
    affectedServers: ['db-mysql-dc1-primary'],
    description: 'Primary DB latency spike',
    status: 'active',
    anomalies: [
      {
        server_id: 'db-mysql-dc1-primary',
        server_name: 'MySQL Primary',
        metric: 'CPU',
        value: 95,
        severity: 'critical',
      },
    ],
    recommendations: [
      {
        action: 'Throttle long-running queries',
        priority: 'high',
        expected_impact: 'Reduce DB saturation',
      },
    ],
    ...overrides,
  };
}

describe('auto-report formatter sections', () => {
  it('builds markdown detection section with threshold and anomaly rows', () => {
    const output = buildDetectionSection(createReport());

    expect(output).toContain('## 🔍 탐지 방법 (Detection)');
    expect(output).toContain('CPU | 80% | 90%');
    expect(output).toContain('| MySQL Primary | CPU | 95.0 | Critical |');
  });

  it('builds markdown resolution section using role-specific commands', () => {
    const output = buildResolutionSection(createReport());

    expect(output).toContain('## 🔧 해결 절차 (Resolution Steps)');
    expect(output).toContain('### Data Tier (MySQL)');
    expect(output).toContain('mysqladmin -u root status');
  });

  it('builds markdown topology impact section from infrastructure topology', () => {
    const output = buildTopologyImpactSection(createReport());

    expect(output).toContain('## 🌐 토폴로지 영향 분석');
    expect(output).toContain('`api-was-dc1-01`');
    expect(output).toContain('`web-nginx-dc1-01`');
    expect(output).toContain('`db-mysql-dc1-replica`');
  });

  it('builds text detection section with condensed anomaly summary', () => {
    const output = buildDetectionSectionText(createReport());

    expect(output).toContain('탐지 방법');
    expect(output).toContain('MySQL Primary: CPU = 95.0 → Critical');
  });

  it('builds text resolution section with compact command list', () => {
    const output = buildResolutionSectionText(createReport());

    expect(output).toContain('해결 절차');
    expect(output).toContain('[DATABASE] db-mysql-dc1-primary');
    expect(output).toContain('1. 상태 확인: mysqladmin -u root status');
  });

  it('builds text topology impact section for upstream impact only', () => {
    const output = buildTopologyImpactSectionText(createReport());

    expect(output).toContain('토폴로지 영향 분석');
    expect(output).toContain('db-mysql-dc1-primary');
    expect(output).toContain('api-was-dc1-01');
  });
});
