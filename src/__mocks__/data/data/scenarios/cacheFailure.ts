import { normalMetrics, SERVERS } from '../constants';
import type { ScenarioTimeline } from '../types';

// 시나리오 3: Cache 장애 (12-18시)
export const scenario3: ScenarioTimeline = {
  id: 'cache-failure',
  name: 'Cache 장애 연쇄 영향',
  timeRange: [12, 18],
  phases: [
    {
      name: '정상',
      durationHours: 1,
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
      durationHours: 1,
      serverMetrics: [
        {
          serverId: 'cache-redis-dc1-01',
          metrics: {
            cpu: [25, 45],
            memory: [55, 70],
            disk: [40, 42],
            network: [60, 75],
            responseTime: [10, 50],
          },
          curveType: 'linear',
        },
        ...SERVERS.filter((s) => s.id !== 'cache-redis-dc1-01').map((s) => ({
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
      name: '장애',
      durationHours: 2,
      serverMetrics: [
        {
          serverId: 'cache-redis-dc1-01',
          metrics: {
            cpu: [45, 85],
            memory: [70, 92],
            disk: [42, 44],
            network: [75, 95],
            responseTime: [50, 5000],
            errorRate: [0.01, 10],
          },
          curveType: 'spike',
        },
        {
          serverId: 'cache-redis-dc1-02',
          metrics: {
            cpu: [25, 80],
            memory: [55, 88],
            disk: [40, 43],
            network: [60, 90],
            responseTime: [10, 4000],
            errorRate: [0.01, 8],
          },
          curveType: 'spike',
        },
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [40, 75],
            memory: [60, 80],
            disk: [70, 72],
            network: [45, 70],
            responseTime: [50, 1500],
          },
          curveType: 'exponential',
        },
        {
          serverId: 'db-mysql-dc1-replica',
          metrics: {
            cpu: [40, 72],
            memory: [60, 78],
            disk: [70, 71],
            network: [45, 68],
            responseTime: [50, 1400],
          },
          curveType: 'exponential',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'cache-redis-dc1-01',
              'cache-redis-dc1-02',
              'db-mysql-dc1-primary',
              'db-mysql-dc1-replica',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 2,
              normalMetrics[s.type].cpu + 10,
            ],
            memory: [
              normalMetrics[s.type].memory + 2,
              normalMetrics[s.type].memory + 10,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk + 1],
            network: [
              normalMetrics[s.type].network + 3,
              normalMetrics[s.type].network + 15,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '부분회복',
      durationHours: 2,
      serverMetrics: [
        {
          serverId: 'cache-redis-dc1-01',
          metrics: {
            cpu: [85, 35],
            memory: [92, 60],
            disk: [44, 41],
            network: [95, 65],
            responseTime: [5000, 20],
            errorRate: [10, 0.1],
          },
          curveType: 'linear',
        },
        {
          serverId: 'cache-redis-dc1-02',
          metrics: {
            cpu: [80, 30],
            memory: [88, 58],
            disk: [43, 41],
            network: [90, 62],
            responseTime: [4000, 15],
            errorRate: [8, 0.1],
          },
          curveType: 'linear',
        },
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [75, 45],
            memory: [80, 63],
            disk: [72, 71],
            network: [70, 48],
          },
          curveType: 'linear',
        },
        {
          serverId: 'db-mysql-dc1-replica',
          metrics: {
            cpu: [72, 43],
            memory: [78, 62],
            disk: [71, 70],
            network: [68, 47],
          },
          curveType: 'linear',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'cache-redis-dc1-01',
              'cache-redis-dc1-02',
              'db-mysql-dc1-primary',
              'db-mysql-dc1-replica',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 10,
              normalMetrics[s.type].cpu + 2,
            ],
            memory: [
              normalMetrics[s.type].memory + 10,
              normalMetrics[s.type].memory + 2,
            ],
            disk: [normalMetrics[s.type].disk + 1, normalMetrics[s.type].disk],
            network: [
              normalMetrics[s.type].network + 15,
              normalMetrics[s.type].network + 4,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
  ],
};
