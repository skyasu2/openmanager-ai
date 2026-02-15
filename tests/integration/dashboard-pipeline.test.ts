/**
 * 🔗 /api/servers-unified Integration Test
 *
 * 현재 대시보드 서버 목록 파이프라인(정렬/검색/페이지네이션) 회귀 방지.
 *
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedServerMetrics } from '@/types/server';

const { mockGetAllAsEnhancedMetrics, mockGetServerAsEnhanced } = vi.hoisted(
  () => ({
    mockGetAllAsEnhancedMetrics: vi.fn(),
    mockGetServerAsEnhanced: vi.fn(),
  })
);

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/services/monitoring', () => ({
  getServerMonitoringService: () => ({
    getAllAsEnhancedMetrics: mockGetAllAsEnhancedMetrics,
    getServerAsEnhanced: mockGetServerAsEnhanced,
  }),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/servers-unified/route';

function makeServer(
  id: string,
  cpuUsage: number,
  status: EnhancedServerMetrics['status'] = 'online'
): EnhancedServerMetrics {
  return {
    id,
    name: id,
    hostname: `${id}.openmanager.local`,
    status,
    cpu: cpuUsage,
    cpu_usage: cpuUsage,
    memory: 40,
    memory_usage: 40,
    disk: 30,
    disk_usage: 30,
    network: 20,
    network_in: 12,
    network_out: 8,
    uptime: 3600,
    responseTime: 120,
    last_updated: new Date().toISOString(),
    location: 'seoul',
    alerts: [],
    ip: '10.0.0.10',
    os: 'linux',
    type: 'web',
    role: 'web',
    environment: 'production',
    provider: 'test',
    specs: {
      cpu_cores: 4,
      memory_gb: 8,
      disk_gb: 100,
      network_speed: '1Gbps',
    },
    lastUpdate: new Date().toISOString(),
    services: [],
    systemInfo: {
      os: 'linux',
      uptime: '1h',
      processes: 100,
      zombieProcesses: 0,
      loadAverage: '0.10, 0.08, 0.05',
      lastUpdate: new Date().toISOString(),
    },
    networkInfo: {
      interface: 'eth0',
      receivedBytes: '10 MB/s',
      sentBytes: '7 MB/s',
      receivedErrors: 0,
      sentErrors: 0,
      status: 'online',
    },
  };
}

describe('/api/servers-unified Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllAsEnhancedMetrics.mockReturnValue([
      makeServer('web-01', 45, 'online'),
      makeServer('api-01', 75, 'warning'),
      makeServer('db-01', 90, 'critical'),
    ]);
    mockGetServerAsEnhanced.mockReturnValue(null);
  });

  it('GET list 요청 시 페이지네이션 포함 응답을 반환한다', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/servers-unified?page=1&limit=2'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('list');
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.totalPages).toBe(2);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, max-age=0'
    );
  });

  it('정렬/검색 파라미터를 적용한다', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/servers-unified?search=db&sortBy=cpu&sortOrder=desc'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe('db-01');
    expect(data.data[0].cpu_usage).toBe(90);
  });
});
