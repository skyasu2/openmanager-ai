import { normalMetrics, SERVERS } from '../constants';
import type { ScenarioTimeline } from '../types';

// 시나리오 4: 네트워크 병목 (18-24시)
export const scenario4: ScenarioTimeline = {
  id: 'network-bottleneck',
  name: '네트워크 병목 현상',
  timeRange: [18, 24],
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
      serverMetrics: SERVERS.map((s) => ({
        serverId: s.id,
        metrics: {
          cpu: [normalMetrics[s.type].cpu, normalMetrics[s.type].cpu + 5],
          memory: [
            normalMetrics[s.type].memory,
            normalMetrics[s.type].memory + 3,
          ],
          disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk],
          network: [
            normalMetrics[s.type].network,
            normalMetrics[s.type].network + 20,
          ],
        },
        curveType: 'linear' as const,
      })),
    },
    {
      name: '악화',
      durationHours: 2,
      serverMetrics: [
        {
          serverId: 'api-was-dc1-01',
          metrics: {
            cpu: [40, 70],
            memory: [53, 75],
            disk: [55, 56],
            network: [70, 92],
            responseTime: [150, 2000],
          },
          curveType: 'exponential',
        },
        {
          serverId: 'api-was-dc1-02',
          metrics: {
            cpu: [40, 68],
            memory: [53, 73],
            disk: [55, 56],
            network: [70, 90],
            responseTime: [150, 1900],
          },
          curveType: 'exponential',
        },
        {
          serverId: 'web-nginx-dc1-01',
          metrics: {
            cpu: [35, 60],
            memory: [48, 68],
            disk: [60, 61],
            network: [60, 88],
            responseTime: [100, 1500],
          },
          curveType: 'exponential',
        },
        {
          serverId: 'web-nginx-dc1-02',
          metrics: {
            cpu: [35, 58],
            memory: [48, 66],
            disk: [60, 61],
            network: [60, 86],
            responseTime: [100, 1400],
          },
          curveType: 'exponential',
        },
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [40, 65],
            memory: [60, 75],
            disk: [70, 71],
            network: [45, 80],
          },
          curveType: 'linear',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'api-was-dc1-01',
              'api-was-dc1-02',
              'web-nginx-dc1-01',
              'web-nginx-dc1-02',
              'db-mysql-dc1-primary',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 5,
              normalMetrics[s.type].cpu + 12,
            ],
            memory: [
              normalMetrics[s.type].memory + 3,
              normalMetrics[s.type].memory + 10,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk + 1],
            network: [
              normalMetrics[s.type].network + 20,
              normalMetrics[s.type].network + 35,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '절정',
      durationHours: 1,
      serverMetrics: [
        {
          serverId: 'api-was-dc1-01',
          metrics: {
            cpu: [70, 85],
            memory: [75, 88],
            disk: [56, 57],
            network: [92, 96],
            responseTime: [2000, 3500],
            errorRate: [0.2, 4],
          },
          curveType: 'spike',
        },
        {
          serverId: 'api-was-dc1-02',
          metrics: {
            cpu: [68, 82],
            memory: [73, 86],
            disk: [56, 57],
            network: [90, 94],
            responseTime: [1900, 3300],
            errorRate: [0.2, 3.5],
          },
          curveType: 'spike',
        },
        {
          serverId: 'web-nginx-dc1-01',
          metrics: {
            cpu: [60, 75],
            memory: [68, 80],
            disk: [61, 62],
            network: [88, 93],
            responseTime: [1500, 2500],
            errorRate: [0.1, 3],
          },
          curveType: 'spike',
        },
        {
          serverId: 'web-nginx-dc1-02',
          metrics: {
            cpu: [58, 72],
            memory: [66, 78],
            disk: [61, 62],
            network: [86, 91],
            responseTime: [1400, 2400],
            errorRate: [0.1, 2.8],
          },
          curveType: 'spike',
        },
        {
          serverId: 'db-mysql-dc1-primary',
          metrics: {
            cpu: [65, 78],
            memory: [75, 85],
            disk: [71, 72],
            network: [80, 90],
          },
          curveType: 'exponential',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'api-was-dc1-01',
              'api-was-dc1-02',
              'web-nginx-dc1-01',
              'web-nginx-dc1-02',
              'db-mysql-dc1-primary',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [
              normalMetrics[s.type].cpu + 12,
              normalMetrics[s.type].cpu + 18,
            ],
            memory: [
              normalMetrics[s.type].memory + 10,
              normalMetrics[s.type].memory + 15,
            ],
            disk: [
              normalMetrics[s.type].disk + 1,
              normalMetrics[s.type].disk + 2,
            ],
            network: [
              normalMetrics[s.type].network + 35,
              normalMetrics[s.type].network + 45,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '회복',
      durationHours: 1,
      serverMetrics: SERVERS.map((s) => ({
        serverId: s.id,
        metrics: {
          cpu: [normalMetrics[s.type].cpu + 18, normalMetrics[s.type].cpu + 3],
          memory: [
            normalMetrics[s.type].memory + 15,
            normalMetrics[s.type].memory + 3,
          ],
          disk: [normalMetrics[s.type].disk + 2, normalMetrics[s.type].disk],
          network: [
            normalMetrics[s.type].network + 45,
            normalMetrics[s.type].network + 5,
          ],
        },
        curveType: 'linear' as const,
      })),
    },
  ],
};
