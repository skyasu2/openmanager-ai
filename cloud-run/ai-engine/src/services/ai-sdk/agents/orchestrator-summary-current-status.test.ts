import { describe, expect, it } from 'vitest';
import { buildActionNeededAnswer } from './orchestrator-summary-current-status';
import type { MetricsToolPayload } from './orchestrator-summary-payload';

const criticalPayload: MetricsToolPayload = {
  source: 'getServerMetrics',
  servers: [
    {
      id: 'web-server-dc1-01',
      name: 'web-server-dc1-01',
      type: 'web',
      status: 'critical',
      cpu: 92,
      memory: 85,
      disk: 60,
      network: 20,
    },
    {
      id: 'db-server-dc1-01',
      name: 'db-server-dc1-01',
      type: 'db',
      status: 'warning',
      cpu: 75,
      memory: 80,
      disk: 50,
      network: 10,
    },
    {
      id: 'cache-redis-dc1-01',
      name: 'cache-redis-dc1-01',
      type: 'cache',
      status: 'online',
      cpu: 30,
      memory: 40,
      disk: 20,
      network: 5,
    },
  ],
};

describe('buildActionNeededAnswer — Q5 action-needed routing fix', () => {
  it.each([
    '어떤 서버가 가장 위험한가요?',
    '가장 위험한 서버 알려줘',
    '위험도 높은 서버 순위',
    '지금 즉시 조치 필요한 서버는?',
    '조치가 필요한 서버 목록',
  ])('returns non-null for action-needed query: "%s"', (query) => {
    const result = buildActionNeededAnswer(query, criticalPayload);
    expect(result).not.toBeNull();
  });

  it('lists critical server first in action-needed answer', () => {
    const result = buildActionNeededAnswer('어떤 서버가 가장 위험한가요?', criticalPayload);
    expect(result).toContain('web-server-dc1-01');
    expect(result).toContain('즉시 조치');
  });

  it.each([
    'CPU 가장 높은 서버는?',
    '서버 상태 요약해줘',
    '메모리 상위 3개',
  ])('returns null for non-action-needed query: "%s"', (query) => {
    const result = buildActionNeededAnswer(query, criticalPayload);
    expect(result).toBeNull();
  });
});
