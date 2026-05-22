import { describe, expect, it } from 'vitest';
import {
  buildReportDownloadFilename,
  formatReportAsMarkdown,
} from './formatters';
import type { IncidentReport } from './types';

function createReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: 'report-1',
    title: 'Redis 메모리 급증',
    severity: 'critical',
    timestamp: new Date('2026-04-20T01:23:45.000Z'),
    affectedServers: ['cache-01'],
    description: '메모리 사용량이 임계치를 초과했습니다.',
    status: 'active',
    timeline: [
      {
        timestamp: '2026-04-20T01:00:00.000Z',
        event: '최초 이상 감지',
        severity: 'warning',
      },
    ],
    recommendations: [
      {
        action: '메모리 캐시 정리',
        priority: 'high',
        expected_impact: '메모리 안정화',
      },
    ],
    postmortem: {
      timeline: ['01:00 - 최초 이상 감지'],
      hypotheses: ['트래픽 급증'],
      prevention: ['오토스케일 임계값 재조정'],
    },
    ...overrides,
  };
}

describe('auto-report formatters', () => {
  it('마크다운 다운로드 내용에 Postmortem 섹션을 포함한다', () => {
    const markdown = formatReportAsMarkdown(createReport());

    expect(markdown).toContain('## Postmortem');
    expect(markdown).toContain('### 타임라인');
    expect(markdown).toContain('### 원인 가설');
    expect(markdown).toContain('### 재발 방지');
  });

  it('다운로드 파일명을 incident-YYYYMMDD-HHMMSS 형식으로 생성한다', () => {
    const filename = buildReportDownloadFilename(createReport(), 'md');

    expect(filename).toBe('incident-20260420-012345.md');
  });

  it('마크다운 다운로드 내용에 반복 로그 패턴과 가용성 영향을 포함한다', () => {
    const markdown = formatReportAsMarkdown(
      createReport({
        systemSummary: {
          totalServers: 18,
          healthyServers: 17,
          warningServers: 1,
          criticalServers: 0,
          uptimePercent: 97.9,
          affectedDurationMinutes: 30,
          dataSlotLabel: '07:00 KST',
        },
        logPatterns: [
          {
            message:
              'redis-server[pid]: memory usage <pct>% of maxmemory limit',
            count: 23,
            severity: 'WARNING',
            serverId: 'cache-redis-dc1-01',
            firstSeen: '2026-04-20T01:00:00.000Z',
            lastSeen: '2026-04-20T01:30:00.000Z',
          },
        ],
      })
    );

    expect(markdown).toContain('가용률 97.9%');
    expect(markdown).toContain('경고 지속 30분');
    expect(markdown).toContain('경고(임계값 초과)');
    expect(markdown).toContain('임계값 초과 비율');
    expect(markdown).toContain('영향 범위(의존 서버 포함)');
    expect(markdown).toContain('## 반복 로그 패턴');
    expect(markdown).toContain(
      '| WARNING | 23건 | cache-redis-dc1-01 | redis-server[pid]: memory usage <pct>% of maxmemory limit |'
    );
  });
});
