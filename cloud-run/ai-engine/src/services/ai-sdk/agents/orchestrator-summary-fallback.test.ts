import { describe, expect, it } from 'vitest';
import {
  buildDeterministicSummaryFallback,
  buildDeterministicSummaryFromCurrentState,
  isDeterministicSummaryQuery,
} from './orchestrator-summary-fallback';

const sampleDomainState = {
  servers: [
    { id: 'web-01', status: 'online', cpu: 25, memory: 35, disk: 40 },
    { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 40, memory: 68, disk: 82 },
    { id: 'db-mysql-dc1-backup', status: 'warning', cpu: 42, memory: 55, disk: 74 },
    { id: 'legacy-offline-01', status: 'offline', cpu: 0, memory: 0, disk: 0 },
  ],
};

describe('buildDeterministicSummaryFallback', () => {
  it('does not classify service command guidance as deterministic status summary', () => {
    expect(
      isDeterministicSummaryQuery(
        'HAProxy에서 현재 연결된 백엔드 서버 목록이랑 상태 확인하는 명령어 알려줘',
        'Advisor Agent',
        1
      )
    ).toBe(false);
  });

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

  it('keeps alert-status operational questions grounded instead of drifting to metric rankings', () => {
    const query =
      '현재 위험/경고 서버를 기준으로 장애 원인을 추정하고, 운영자가 지금 해야 할 조치 3가지만 우선순위로 제안해줘';
    const summary = buildDeterministicSummaryFallback(query, 'Analyst Agent', [
      {
        toolName: 'getServerMetrics',
        result: {
          servers: [
            { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
            {
              id: 'lb-haproxy-dc1-01',
              status: 'warning',
              cpu: 75,
              memory: 38,
              disk: 26,
            },
            { id: 'db-mysql-dc1-backup', status: 'online', cpu: 42, memory: 55, disk: 71 },
          ],
          alertServers: [
            {
              id: 'lb-haproxy-dc1-01',
              status: 'warning',
              cpu: 75,
              memory: 38,
              disk: 26,
              cpuTrend: 'stable',
            },
          ],
        },
      },
    ]);

    expect(summary).toContain('전체 3대: 정상 2대, 경고 1대, 위험 0대');
    expect(summary).toContain('lb-haproxy-dc1-01: CPU 75%');
    expect(summary).toContain('1. lb-haproxy-dc1-01: 상위 프로세스');
    expect(summary).toContain('2. lb-haproxy-dc1-01: 최근 배포');
    expect(summary).toContain('3. lb-haproxy-dc1-01: 같은 추세');
    expect(summary).not.toContain('메모리 사용률 상위');
  });

  it('prioritizes critical operational alerts before higher-metric warnings', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 위험/경고 서버를 기준으로 운영자가 해야 할 조치 2가지를 제안해줘',
      'Analyst Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'api-critical-01', status: 'critical', cpu: 66, memory: 64, disk: 35 },
              { id: 'cache-warning-01', status: 'warning', cpu: 94, memory: 82, disk: 41 },
            ],
            alertServers: [
              {
                id: 'api-critical-01',
                status: 'critical',
                cpu: 66,
                memory: 64,
                disk: 35,
                cpuTrend: 'stable',
              },
              {
                id: 'cache-warning-01',
                status: 'warning',
                cpu: 94,
                memory: 82,
                disk: 41,
                cpuTrend: 'rising',
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('⚠️ **주의 서버**');
    expect(summary).toContain('• api-critical-01: CPU 66%');
    expect(summary).toContain('• cache-warning-01: CPU 94%');
    expect(summary?.indexOf('api-critical-01')).toBeLessThan(
      summary?.indexOf('cache-warning-01') ?? Number.MAX_SAFE_INTEGER
    );
    expect(summary).toContain('1. api-critical-01: 상위 프로세스');
    expect(summary).toContain('2. cache-warning-01: 상위 프로세스');
    expect(summary).not.toContain('CPU 사용률 상위');
  });

  it('keeps offline operational sections without falling through to metric summaries', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 위험/경고 서버를 기준으로 장애 원인을 추정하고 운영자가 해야 할 조치 1가지를 제안해줘',
      'Analyst Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'worker-offline-01', status: 'offline', cpu: 0, memory: 0, disk: 0 },
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('⛔ **오프라인 서버**');
    expect(summary).toContain('worker-offline-01: 헬스체크 실패 또는 서비스 중단 상태');
    expect(summary).toContain('1. web-01: 메모리 상위 프로세스와 OOM/GC 로그를 확인하세요.');
    expect(summary).not.toContain('CPU 사용률 상위');
  });

  it('distributes per-server action requests across warning servers', () => {
    const query =
      '현재 경고 서버 2대를 기준으로 장애 원인을 추정하고, 각 서버별 즉시 조치 1개씩만 우선순위로 제안해줘. 대시보드 현재 시점 데이터 기준으로 답해줘';
    const summary = buildDeterministicSummaryFallback(query, 'Analyst Agent', [
      {
        toolName: 'getServerMetrics',
        result: {
          servers: [
            { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
            {
              id: 'storage-nfs-dc1-01',
              status: 'warning',
              cpu: 47,
              memory: 45,
              disk: 84,
            },
            {
              id: 'db-mysql-dc1-primary',
              status: 'warning',
              cpu: 70,
              memory: 78,
              disk: 81,
            },
          ],
          alertServers: [
            {
              id: 'storage-nfs-dc1-01',
              status: 'warning',
              cpu: 47,
              memory: 45,
              disk: 84,
              diskTrend: 'rising',
            },
            {
              id: 'db-mysql-dc1-primary',
              status: 'warning',
              cpu: 70,
              memory: 78,
              disk: 81,
              diskTrend: 'rising',
            },
          ],
        },
      },
    ]);

    expect(summary).toContain('1. storage-nfs-dc1-01: 로그 적체');
    expect(summary).toContain('2. db-mysql-dc1-primary: 로그 적체');
    expect(summary).not.toContain('3. ');
  });

  it('keeps explicitly named resource warning servers instead of substituting LLM-selected peers', () => {
    const query =
      '현재 리소스 경고 TOP 2인 db-mysql-dc1-primary와 db-mysql-dc1-backup을 기준으로 장애 원인을 추정하고, 각 서버별 즉시 조치 1개씩만 우선순위로 제안해줘. 대시보드 현재 시점 데이터 기준으로 답해줘';
    const summary = buildDeterministicSummaryFallback(query, 'Analyst Agent', [
      {
        toolName: 'getServerMetrics',
        result: {
          servers: [
            {
              id: 'db-mysql-dc1-primary',
              status: 'warning',
              cpu: 61,
              memory: 69,
              disk: 81,
            },
            {
              id: 'db-mysql-dc1-backup',
              status: 'online',
              cpu: 42,
              memory: 55,
              disk: 69,
            },
            {
              id: 'db-mysql-dc1-replica',
              status: 'online',
              cpu: 40,
              memory: 56,
              disk: 42,
            },
          ],
          alertServers: [
            {
              id: 'db-mysql-dc1-primary',
              status: 'warning',
              cpu: 61,
              memory: 69,
              disk: 81,
              diskTrend: 'rising',
            },
          ],
        },
      },
    ]);

    expect(summary).toContain('📊 **요청 서버 2대 상태**');
    expect(summary).toContain('1. db-mysql-dc1-primary: 디스크 81%');
    expect(summary).toContain('2. db-mysql-dc1-backup: 디스크 69%');
    expect(summary).toContain('1. db-mysql-dc1-primary: 로그 적체');
    expect(summary).toContain('2. db-mysql-dc1-backup: 로그 적체');
    expect(summary).not.toContain('db-mysql-dc1-replica');
  });

  it('backfills explicitly named servers from current state when tool results are partial', () => {
    const query =
      '현재 리소스 경고 TOP 2인 db-mysql-dc1-primary와 db-mysql-dc1-backup을 기준으로 장애 원인을 추정하고, 각 서버별 즉시 조치 1개씩만 우선순위로 제안해줘. 대시보드 현재 시점 데이터 기준으로 답해줘';
    const summary = buildDeterministicSummaryFallback(
      query,
      'Analyst Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              {
                id: 'db-mysql-dc1-primary',
                status: 'warning',
                cpu: 61,
                memory: 68,
                disk: 82,
              },
            ],
          },
        },
      ],
      sampleDomainState
    );

    expect(summary).toContain('📊 **요청 서버 2대 상태**');
    expect(summary).toContain('db-mysql-dc1-primary');
    expect(summary).toContain('db-mysql-dc1-backup');
    expect(summary).not.toContain('📊 **요청 서버 1대 상태**');
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

  it('builds deterministic CPU top-N ranking from getServerMetricsAdvanced results', () => {
    const summary = buildDeterministicSummaryFallback(
      'CPU 상위 3개 서버를 현재 대시보드 수치 기준으로 짧게 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetricsAdvanced',
          result: {
            responseKind: 'current_metric_ranking',
            servers: [
              {
                id: 'api-was-dc1-01',
                name: 'api-was-dc1-01',
                metrics: { cpu: 85 },
              },
              {
                id: 'api-was-dc1-02',
                name: 'api-was-dc1-02',
                metrics: { cpu: 78 },
              },
              {
                id: 'db-mysql-dc1-primary',
                name: 'db-mysql-dc1-primary',
                metrics: { cpu: 76 },
              },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('📊 **CPU 사용률 상위 3대**');
    expect(summary).toContain('1. api-was-dc1-01: CPU 85%');
    expect(summary).toContain('2. api-was-dc1-02: CPU 78%');
    expect(summary).toContain('3. db-mysql-dc1-primary: CPU 76%');
    expect(summary).not.toContain('cpu 85%');
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

  it('uses the requested metric for threshold filters instead of hardcoding DISK', () => {
    const toolResults = [
      {
        toolName: 'getServerMetrics',
        result: {
          servers: [
            { id: 'cache-redis-dc1-01', status: 'warning', cpu: 20, memory: 92, disk: 30 },
            { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 65, disk: 88 },
            { id: 'api-was-dc1-01', status: 'online', cpu: 77, memory: 55, disk: 45 },
          ],
        },
      },
    ];

    const memorySummary = buildDeterministicSummaryFallback(
      'MEM 사용률 90% 이상 서버 찾아줘',
      'NLQ Agent',
      toolResults
    );
    expect(memorySummary).toContain('메모리 사용률 90% 이상 서버 1대');
    expect(memorySummary).toContain('cache-redis-dc1-01: 메모리 92%');
    expect(memorySummary).not.toContain('DISK 사용률 90%');

    const cpuSummary = buildDeterministicSummaryFallback(
      'CPU >= 70 서버 찾아줘',
      'NLQ Agent',
      toolResults
    );
    expect(cpuSummary).toContain('CPU 사용률 70% 이상 서버 1대');
    expect(cpuSummary).toContain('api-was-dc1-01: CPU 77%');
    expect(cpuSummary).not.toContain('db-mysql-dc1-primary');
  });

  it('uses the requested metric for top-N rankings instead of hardcoding CPU', () => {
    const summary = buildDeterministicSummaryFallback(
      'DISK 사용률이 가장 높은 서버 2대 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'cache-redis-dc1-01', status: 'warning', cpu: 20, memory: 92, disk: 30 },
              { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 65, disk: 88 },
              { id: 'api-was-dc1-01', status: 'online', cpu: 77, memory: 55, disk: 45 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('DISK 사용률 상위 2대');
    expect(summary).toContain('1. db-mysql-dc1-primary: DISK 88%');
    expect(summary).toContain('2. api-was-dc1-01: DISK 45%');
    expect(summary).not.toContain('CPU 사용률 상위');
  });

  it('builds deterministic status filters without treating them as metric thresholds', () => {
    const summary = buildDeterministicSummaryFallback(
      'status: warning 서버 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'cache-redis-dc1-01', status: 'warning', cpu: 20, memory: 92, disk: 30 },
              { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 65, disk: 88 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('상태 warning 서버 1대');
    expect(summary).toContain('cache-redis-dc1-01: 상태 warning');
    expect(summary).not.toContain('DISK 사용률');
  });

  it('formats filterServers results even when no server matched', () => {
    const summary = buildDeterministicSummaryFallback(
      'DISK >= 80 서버 찾아줘',
      'NLQ Agent',
      [
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'disk >= 80%',
            servers: [],
            summary: { matched: 0, returned: 0, total: 18 },
            emptyResultHint: {
              topServers: [
                { id: 'db-mysql-dc1-backup', name: 'DB Backup', status: 'online', value: 69 },
              ],
              suggestion: '조건(disk >= 80%)에 맞는 서버가 없습니다.',
            },
            timestamp: '2026-04-29T07:00:00.000Z',
          },
        },
      ]
    );

    expect(summary).toContain('DISK 사용률 80% 이상 서버 0대');
    expect(summary).toContain('기준: 전체 18대 중 DISK >= 80%');
    expect(summary).toContain('현재 기준을 만족한 서버는 없습니다.');
    expect(summary).toContain('db-mysql-dc1-backup: 69%');
  });

  it('prefers getServerMetrics over filterServers when both tool payloads are present', () => {
    const summary = buildDeterministicSummaryFallback(
      'DISK >= 80 서버 찾아줘',
      'NLQ Agent',
      [
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'disk >= 80%',
            servers: [
              {
                id: 'storage-nfs-dc1-01',
                status: 'warning',
                cpu: 35,
                memory: 44,
                disk: 88,
              },
            ],
            summary: { matched: 1, returned: 1, total: 18 },
          },
        },
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 50, disk: 63 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('DISK 사용률 80% 이상 서버 0대');
    expect(summary).toContain('기준: 전체 2대 중 DISK >= 80%');
    expect(summary).not.toContain('storage-nfs-dc1-01');
  });

  it('returns null for malformed getServerMetrics payloads before considering later tools', () => {
    const summary = buildDeterministicSummaryFallback(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: 'not-an-array',
          },
        },
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'status == warning',
            servers: [
              { id: 'cache-redis-dc1-01', status: 'warning', cpu: 20, memory: 92, disk: 30 },
            ],
            summary: { matched: 1, returned: 1, total: 18 },
          },
        },
      ]
    );

    expect(summary).toBeNull();
  });

  it('formats empty status filters from filter summary totals', () => {
    const summary = buildDeterministicSummaryFallback(
      'status: critical 서버 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'status == critical',
            servers: [],
            summary: { matched: 0, returned: 0, total: 18 },
          },
        },
      ]
    );

    expect(summary).toContain('상태 critical 서버 0대');
    expect(summary).toContain('기준: 전체 18대 중 status == critical');
    expect(summary).toContain('현재 기준을 만족한 서버는 없습니다.');
  });

  it('uses filterServers summary matched count when returned rows are partial', () => {
    const summary = buildDeterministicSummaryFallback(
      'DISK >= 70 서버 찾아줘',
      'NLQ Agent',
      [
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'disk >= 70%',
            servers: [
              { id: 'storage-nfs-dc1-01', status: 'warning', cpu: 35, memory: 44, disk: 88 },
              { id: 'db-mysql-dc1-backup', status: 'warning', cpu: 42, memory: 55, disk: 74 },
            ],
            summary: { matched: 5, returned: 2, total: 18 },
          },
        },
      ]
    );

    expect(summary).toContain('DISK 사용률 70% 이상 서버 5대');
    expect(summary).toContain('기준: 전체 18대 중 DISK >= 70%');
    expect(summary).toContain('1. storage-nfs-dc1-01: DISK 88%');
    expect(summary).toContain('2. db-mysql-dc1-backup: DISK 74%');
    expect(summary).not.toContain('3. ');
  });

  it('trusts filterServers returned rows instead of re-filtering by threshold', () => {
    const summary = buildDeterministicSummaryFallback(
      'CPU >= 80 서버 찾아줘',
      'NLQ Agent',
      [
        {
          toolName: 'filterServers',
          result: {
            success: true,
            condition: 'cpu >= 80%',
            servers: [
              { id: 'api-was-dc1-01', status: 'warning', cpu: 70, memory: 55, disk: 45 },
            ],
            summary: { matched: 1, returned: 1, total: 18 },
          },
        },
      ]
    );

    expect(summary).toContain('CPU 사용률 80% 이상 서버 1대');
    expect(summary).toContain('api-was-dc1-01: CPU 70%');
  });

  it('builds deterministic network top-N ranking with network-specific checks', () => {
    const summary = buildDeterministicSummaryFallback(
      '네트워크 사용률이 가장 높은 서버 2대 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 70, memory: 30, disk: 20, network: 10 },
              { id: 'lb-haproxy-dc1-01', status: 'online', cpu: 25, memory: 45, disk: 26, network: 91 },
              { id: 'api-was-dc1-01', status: 'online', cpu: 63, memory: 44, disk: 31, network: 76 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('네트워크 사용률 상위 2대');
    expect(summary).toContain('1. lb-haproxy-dc1-01: 네트워크 91%');
    expect(summary).toContain('2. api-was-dc1-01: 네트워크 76%');
    expect(summary).toContain('인터페이스 오류, 연결 수, LB 트래픽 분산');
    expect(summary).not.toContain('web-01');
  });

  it('builds deterministic ascending CPU rankings and excludes offline servers', () => {
    const summary = buildDeterministicSummaryFallback(
      'CPU 사용률이 가장 낮은 서버 2대 알려줘',
      'NLQ Agent',
      [
        {
          toolName: 'getServerMetrics',
          result: {
            servers: [
              { id: 'web-01', status: 'online', cpu: 25, memory: 30, disk: 20 },
              { id: 'api-was-dc1-01', status: 'online', cpu: 63, memory: 44, disk: 31 },
              { id: 'db-mysql-dc1-primary', status: 'online', cpu: 40, memory: 65, disk: 88 },
              { id: 'legacy-offline-01', status: 'offline', cpu: 1, memory: 0, disk: 0 },
            ],
          },
        },
      ]
    );

    expect(summary).toContain('CPU 사용률 하위 2대');
    expect(summary).toContain('1. web-01: CPU 25%');
    expect(summary).toContain('2. db-mysql-dc1-primary: CPU 40%');
    expect(summary).not.toContain('legacy-offline-01');
  });

  it('routes data queries to deterministic when servers are present, LLM-required queries always to LLM', () => {
    // Data queries with servers present → deterministic
    expect(isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'NLQ Agent', 3)).toBe(true);
    expect(isDeterministicSummaryQuery('CPU 높은 서버 찾아줘', 'NLQ Agent', 5)).toBe(true);
    expect(isDeterministicSummaryQuery('DISK 사용률 70% 이상 서버를 위험도 순으로 알려줘', 'Analyst Agent', 4)).toBe(true);
    // Same queries with agentName ignored — result depends on intent + server count, not agentName
    expect(isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'Analyst Agent', 3)).toBe(true);
    // No servers → always false regardless of query type
    expect(isDeterministicSummaryQuery('현재 모든 서버의 상태를 요약해줘', 'NLQ Agent', 0)).toBe(false);
    // LLM-required intents → always false regardless of server count
    expect(isDeterministicSummaryQuery('왜 서버가 갑자기 느려졌어?', 'NLQ Agent', 10)).toBe(false);
    expect(isDeterministicSummaryQuery('다음 주 CPU 사용률 예측해줘', 'Analyst Agent', 10)).toBe(false);
    expect(isDeterministicSummaryQuery('어떻게 해야 서버 부하를 줄일 수 있어?', 'NLQ Agent', 10)).toBe(false);
    expect(
      isDeterministicSummaryQuery(
        '현재 위험/경고 서버를 기준으로 운영자가 해야 할 조치 3가지만 제안해줘',
        'Analyst Agent',
        18
      )
    ).toBe(true);
    expect(
      isDeterministicSummaryQuery(
        '현재 리소스 경고 TOP 2인 db-mysql-dc1-primary와 db-mysql-dc1-backup을 기준으로 장애 원인을 추정하고, 각 서버별 즉시 조치 1개씩 제안해줘',
        'Analyst Agent',
        18
      )
    ).toBe(true);
  });

  it('builds deterministic summary from current state when tool results are absent', () => {
    const summary = buildDeterministicSummaryFromCurrentState(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      sampleDomainState
    );

    expect(summary).toBeTruthy();
    expect(summary).toContain('📊 **서버 현황 요약**');
    expect(summary).toContain('💡 **권고**');
  });

  it('does not label snapshot-only threshold values as rising trend evidence', () => {
    const summary = buildDeterministicSummaryFromCurrentState(
      '현재 모든 서버의 상태를 요약해줘',
      'NLQ Agent',
      {
        servers: [
          { id: 'api-01', status: 'critical', cpu: 92, memory: 88, disk: 40 },
        ],
      }
    );

    expect(summary).toBeTruthy();
    expect(summary).not.toContain('상승 추세');
    expect(summary).toContain('평균 대비 큰 변동 없이 안정적입니다');
  });
});
