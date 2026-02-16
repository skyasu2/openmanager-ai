import { normalMetrics, SERVERS } from '../constants';
import type { ScenarioTimeline } from '../types';

// 시나리오 1: DB 과부하 연쇄 장애 (0-6시)
export const scenario1: ScenarioTimeline = {
  id: 'db-overload',
  name: 'DB 과부하 연쇄 장애',
  timeRange: [0, 6],
  phases: [
    {
      name: '정상',
      durationHours: 1, // 0-1시
      serverMetrics: SERVERS.map((s) => ({
        serverId: s.id,
        metrics: {
          cpu: [normalMetrics[s.type].cpu, normalMetrics[s.type].cpu],
          memory: [normalMetrics[s.type].memory, normalMetrics[s.type].memory],
          disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk],
          network: [
            normalMetrics[s.type].network,
            normalMetrics[s.type].network,
          ],
        },
        curveType: 'linear' as const,
      })),
    },
    {
      name: '징조',
      durationHours: 1, // 1-2시
      serverMetrics: [
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [40, 60],
            memory: [60, 70],
            disk: [70, 72],
            network: [45, 55],
            responseTime: [50, 200],
          },
          curveType: 'linear' as const,
        },
        // 나머지 서버는 정상
        ...SERVERS.filter((s) => s.id !== 'db-mysql-dc1-primary').map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [normalMetrics[s.type].cpu, normalMetrics[s.type].cpu + 2],
            memory: [
              normalMetrics[s.type].memory,
              normalMetrics[s.type].memory + 2,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk],
            network: [
              normalMetrics[s.type].network,
              normalMetrics[s.type].network + 3,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '악화',
      durationHours: 1, // 2-3시
      serverMetrics: [
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [60, 85],
            memory: [70, 85],
            disk: [72, 74],
            network: [55, 70],
            responseTime: [200, 1000],
            errorRate: [0.05, 2],
          },
          curveType: 'exponential' as const,
        },
        {
          serverId: 'db-mysql-dc1-replica',
          metrics: {
            cpu: [40, 70],
            memory: [60, 75],
            disk: [70, 72],
            network: [45, 60],
            responseTime: [50, 400],
          },
          curveType: 'exponential' as const,
        },
        {
          serverId: 'api-was-dc1-01',
          metrics: {
            cpu: [35, 55],
            memory: [50, 60],
            disk: [55, 56],
            network: [50, 60],
            responseTime: [150, 800],
            errorRate: [0.2, 1.5],
          },
          curveType: 'linear' as const,
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'db-mysql-dc1-primary',
              'db-mysql-dc1-replica',
              'api-was-dc1-01',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [normalMetrics[s.type].cpu + 2, normalMetrics[s.type].cpu + 5],
            memory: [
              normalMetrics[s.type].memory + 2,
              normalMetrics[s.type].memory + 5,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk],
            network: [
              normalMetrics[s.type].network + 3,
              normalMetrics[s.type].network + 8,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '절정',
      durationHours: 2, // 3-5시
      serverMetrics: [
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [85, 92],
            memory: [85, 92],
            disk: [74, 75],
            network: [70, 75],
            responseTime: [1000, 5000],
            errorRate: [2, 5],
          },
          curveType: 'spike' as const,
        },
        {
          serverId: 'db-mysql-dc1-replica',
          metrics: {
            cpu: [70, 85],
            memory: [75, 88],
            disk: [72, 74],
            network: [60, 70],
            responseTime: [400, 2000],
            errorRate: [0.05, 3],
          },
          curveType: 'spike' as const,
        },
        {
          serverId: 'api-was-dc1-01',
          metrics: {
            cpu: [55, 75],
            memory: [60, 75],
            disk: [56, 58],
            network: [60, 70],
            responseTime: [800, 3000],
            errorRate: [1.5, 5],
          },
          curveType: 'exponential' as const,
        },
        {
          serverId: 'api-was-dc1-02',
          metrics: {
            cpu: [35, 70],
            memory: [50, 72],
            disk: [55, 57],
            network: [50, 68],
            responseTime: [150, 2500],
            errorRate: [0.2, 4],
          },
          curveType: 'exponential' as const,
        },
        {
          serverId: 'web-nginx-dc1-01',
          metrics: {
            cpu: [30, 60],
            memory: [45, 65],
            disk: [60, 62],
            network: [40, 60],
            responseTime: [100, 2000],
            errorRate: [0.1, 5],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'web-nginx-dc1-02',
          metrics: {
            cpu: [30, 58],
            memory: [45, 63],
            disk: [60, 62],
            network: [40, 58],
            responseTime: [100, 1800],
            errorRate: [0.1, 4.5],
          },
          curveType: 'linear' as const,
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'db-mysql-dc1-primary',
              'db-mysql-dc1-replica',
              'api-was-dc1-01',
              'api-was-dc1-02',
              'web-nginx-dc1-01',
              'web-nginx-dc1-02',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 5,
              normalMetrics[s.type].cpu + 10,
            ],
            memory: [
              normalMetrics[s.type].memory + 5,
              normalMetrics[s.type].memory + 10,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk + 1],
            network: [
              normalMetrics[s.type].network + 8,
              normalMetrics[s.type].network + 15,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '부분회복',
      durationHours: 1, // 5-6시
      serverMetrics: [
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [92, 90],
            memory: [92, 90],
            disk: [75, 75],
            network: [75, 72],
            responseTime: [5000, 4500],
            errorRate: [5, 4.5],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'db-mysql-dc1-replica',
          metrics: {
            cpu: [85, 82],
            memory: [88, 85],
            disk: [74, 73],
            network: [70, 68],
            responseTime: [2000, 1800],
            errorRate: [3, 2.5],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'api-was-dc1-01',
          metrics: {
            cpu: [75, 65],
            memory: [75, 68],
            disk: [58, 57],
            network: [70, 62],
            responseTime: [3000, 2000],
            errorRate: [5, 3],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'api-was-dc1-02',
          metrics: {
            cpu: [70, 60],
            memory: [72, 65],
            disk: [57, 56],
            network: [68, 60],
            responseTime: [2500, 1500],
            errorRate: [4, 2.5],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'web-nginx-dc1-01',
          metrics: {
            cpu: [60, 45],
            memory: [65, 52],
            disk: [62, 61],
            network: [60, 48],
            responseTime: [2000, 800],
            errorRate: [5, 1.5],
          },
          curveType: 'linear' as const,
        },
        {
          serverId: 'web-nginx-dc1-02',
          metrics: {
            cpu: [58, 43],
            memory: [63, 50],
            disk: [62, 61],
            network: [58, 46],
            responseTime: [1800, 700],
            errorRate: [4.5, 1.3],
          },
          curveType: 'linear' as const,
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'db-mysql-dc1-primary',
              'db-mysql-dc1-replica',
              'api-was-dc1-01',
              'api-was-dc1-02',
              'web-nginx-dc1-01',
              'web-nginx-dc1-02',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 10,
              normalMetrics[s.type].cpu + 3,
            ],
            memory: [
              normalMetrics[s.type].memory + 10,
              normalMetrics[s.type].memory + 3,
            ],
            disk: [normalMetrics[s.type].disk + 1, normalMetrics[s.type].disk],
            network: [
              normalMetrics[s.type].network + 15,
              normalMetrics[s.type].network + 5,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
  ],
};
