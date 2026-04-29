import { describe, expect, it } from 'vitest';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
} from './orchestrator-summary-fallback';

describe('buildDeterministicSummaryFallback', () => {
  it('builds a deterministic NLQ summary from getServerMetrics results', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
              { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
              { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
            ],
            alertServers: [
              {
                id: 'api-01',
                status: 'warning',
                cpu: 71,
                memory: 78,
                disk: 36,
                memoryTrend: 'rising',
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('📊 **서버 현황 요약**');
    expect(summary).toContain('전체 3대');
    expect(summary).toContain('⚠️ **주의 서버**');
    expect(summary).toContain('api-01');
    expect(summary).toContain('💡 **권고**');
  });

  it('추세 섹션에서 평균 대비 변화량을 보여주고 권고를 더 구체화한다', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
              {
                id: 'api-01',
                status: 'critical',
                cpu: 91,
                memory: 78,
                disk: 36,
                dailyTrend: {
                  cpu: { avg: 57 },
                  memory: { avg: 66 },
                  disk: { avg: 34 },
                },
              },
            ],
            alertServers: [
              {
                id: 'api-01',
                status: 'critical',
                cpu: 91,
                memory: 78,
                disk: 36,
                cpuTrend: 'rising',
                dailyAvg: { cpu: 57, memory: 66, disk: 34 },
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('CPU 평균 57% → 현재 91% (+34%p, 상승 추세 ↑)');
    expect(summary).toContain('최근 15분 상위 프로세스, 직전 배포/배치, LB 트래픽 급증 여부를 우선 확인하세요.');
  });

  it('returns null for unrelated non-summary queries', () => {
    const summary = buildDeterministicSummaryFallback(
      '최근 에러 로그를 보여줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [{ id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 }],
          },
        },
      ]
    );

    expect(summary).toBeNull();
  });

  it('excludes offline servers from average metrics while preserving offline count', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 40, memory: 60, disk: 30 },
              { id: 'api-01', status: 'warning', cpu: 60, memory: 40, disk: 50 },
              { id: 'db-01', status: 'offline', cpu: 0, memory: 0, disk: 0 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('정상 1대, 경고 1대, 위험 0대, 오프라인 1대');
    expect(summary).toContain('평균 CPU: 50%, 메모리: 50%, 디스크: 40%');
  });

  it('honors requested attention server and exactly two immediate actions', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 전체 서버 상태를 운영자에게 보고하듯 요약해줘. 반드시 총 서버 수, 정상/경고/위험 수, 가장 주의할 서버 1대와 즉시 조치 2개를 포함해줘.',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'lb-01', status: 'online', cpu: 72, memory: 45, disk: 26 },
              { id: 'api-01', status: 'online', cpu: 55, memory: 44, disk: 31 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('전체 3대: 정상 3대, 경고 0대, 위험 0대');
    expect(summary).toContain('관찰 우선: lb-01: CPU 72%');
    expect(summary).toContain('1. lb-01: 상위 프로세스');
    expect(summary).toContain('2. lb-01: 최근 배포');
    expect(summary).not.toContain('3. lb-01:');
  });

  it('builds deterministic CPU top-N ranking with one check item per server', () => {
    const summary = buildDeterministicSummaryFallback(
      'CPU 사용률이 가장 높은 서버 3대를 현재 수치와 함께 순서대로 알려주고, 운영자가 바로 확인할 항목을 서버별로 1개씩 제안해줘.',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'lb-haproxy-dc1-01', status: 'online', cpu: 72, memory: 45, disk: 26 },
              { id: 'api-was-dc1-01', status: 'online', cpu: 63, memory: 44, disk: 31 },
              { id: 'storage-nfs-dc1-01', status: 'online', cpu: 40, memory: 35, disk: 54 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('📊 **CPU 사용률 상위 3대**');
    expect(summary).toContain('1. lb-haproxy-dc1-01: CPU 72%');
    expect(summary).toContain('2. api-was-dc1-01: CPU 63%');
    expect(summary).toContain('3. storage-nfs-dc1-01: CPU 40%');
    expect(summary).toContain('💡 **서버별 확인 항목**');
    expect(summary).toContain('1. lb-haproxy-dc1-01: HAProxy worker CPU');
    expect(summary).toContain('2. api-was-dc1-01: 상위 프로세스');
    expect(summary).toContain('3. storage-nfs-dc1-01: NFS/스토리지 프로세스');
    expect(summary).not.toContain('4. ');
  });

  it('builds deterministic DISK threshold ranking for analyst queries', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 18대 서버 중 DISK 사용률이 70% 이상인 서버를 모두 찾아서 위험도 순으로 정렬하고, 각 서버의 잠재적 장애 시점과 권장 조치안을 상세히 분석해줘',
      'Analyst Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'db-mysql-dc1-backup', status: 'warning', cpu: 42, memory: 55, disk: 74 },
              { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 50, disk: 63 },
              { id: 'storage-nfs-dc1-01', status: 'warning', cpu: 35, memory: 44, disk: 80 },
              { id: 'storage-s3gw-dc1-01', status: 'warning', cpu: 44, memory: 48, disk: 72 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('📊 **DISK 사용률 70% 이상 서버 3대**');
    expect(summary).toContain('1. storage-nfs-dc1-01: DISK 80%');
    expect(summary).toContain('2. db-mysql-dc1-backup: DISK 74%');
    expect(summary).toContain('3. storage-s3gw-dc1-01: DISK 72%');
    expect(summary).not.toContain('db-mysql-dc1-primary');
    expect(summary).toContain('잠재적 장애 시점');
    expect(summary).toContain('권장 조치');
  });

  it('identifies NLQ summary prompts that must use deterministic output', () => {
    expect(
      isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'NLQ Agent')
    ).toBe(true);
    expect(
      isDeterministicSummaryQuery('CPU 높은 서버 찾아줘', 'NLQ Agent')
    ).toBe(true);
    expect(
      isDeterministicSummaryQuery('DISK 사용률 70% 이상 서버를 위험도 순으로 알려줘', 'Analyst Agent')
    ).toBe(true);
    expect(
      isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'Analyst Agent')
    ).toBe(false);
  });

  it('builds deterministic summary from current state when tool results are absent', () => {
    const summary = buildDeterministicSummaryFromCurrentState(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent'
    );

    expect(summary).toBeTruthy();
    expect(summary).toContain('📊 **서버 현황 요약**');
    expect(summary).toContain('💡 **권고**');
  });
});
