import { normalMetrics, SERVERS } from '../constants';
import type { ScenarioTimeline } from '../types';

// 시나리오 2: Storage 부족 연쇄 장애 (6-12시)
export const scenario2: ScenarioTimeline = {
  id: 'storage-full',
  name: 'Storage 부족 연쇄 장애',
  timeRange: [6, 12],
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
      durationHours: 2,
      serverMetrics: [
        {
          serverId: 'storage-nfs-dc1-01',
          metrics: {
            cpu: [20, 35],
            memory: [40, 55],
            disk: [75, 90],
            network: [35, 45],
          },
          curveType: 'linear',
        },
        {
          serverId: 'lb-haproxy-dc1-01',
          metrics: {
            cpu: [30, 45],
            memory: [50, 65],
            disk: [80, 92],
            network: [40, 50],
          },
          curveType: 'linear',
        },
        ...SERVERS.filter(
          (s) => !['storage-nfs-dc1-01', 'lb-haproxy-dc1-01'].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [normalMetrics[s.type].cpu, normalMetrics[s.type].cpu + 3],
            memory: [
              normalMetrics[s.type].memory,
              normalMetrics[s.type].memory + 3,
            ],
            disk: [normalMetrics[s.type].disk, normalMetrics[s.type].disk + 2],
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
      name: '절정',
      durationHours: 2,
      serverMetrics: [
        {
          serverId: 'storage-nfs-dc1-01',
          metrics: {
            cpu: [35, 50],
            memory: [55, 75],
            disk: [90, 95],
            network: [45, 60],
          },
          curveType: 'spike',
        },
        {
          serverId: 'lb-haproxy-dc1-01',
          metrics: {
            cpu: [45, 70],
            memory: [65, 85],
            disk: [92, 96],
            network: [50, 65],
          },
          curveType: 'spike',
        },
        {
          serverId: 'storage-s3gw-dc1-01',
          metrics: {
            cpu: [20, 55],
            memory: [40, 70],
            disk: [75, 92],
            network: [35, 55],
          },
          curveType: 'exponential',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'storage-nfs-dc1-01',
              'lb-haproxy-dc1-01',
              'storage-s3gw-dc1-01',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [normalMetrics[s.type].cpu + 3, normalMetrics[s.type].cpu + 8],
            memory: [
              normalMetrics[s.type].memory + 3,
              normalMetrics[s.type].memory + 8,
            ],
            disk: [
              normalMetrics[s.type].disk + 2,
              normalMetrics[s.type].disk + 5,
            ],
            network: [
              normalMetrics[s.type].network + 3,
              normalMetrics[s.type].network + 10,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
    {
      name: '지속',
      durationHours: 1,
      serverMetrics: [
        {
          serverId: 'storage-nfs-dc1-01',
          metrics: {
            cpu: [50, 48],
            memory: [75, 73],
            disk: [95, 94],
            network: [60, 58],
          },
          curveType: 'linear',
        },
        {
          serverId: 'lb-haproxy-dc1-01',
          metrics: {
            cpu: [70, 68],
            memory: [85, 82],
            disk: [96, 95],
            network: [65, 62],
          },
          curveType: 'linear',
        },
        {
          serverId: 'storage-s3gw-dc1-01',
          metrics: {
            cpu: [55, 52],
            memory: [70, 68],
            disk: [92, 91],
            network: [55, 52],
          },
          curveType: 'linear',
        },
        ...SERVERS.filter(
          (s) =>
            ![
              'storage-nfs-dc1-01',
              'lb-haproxy-dc1-01',
              'storage-s3gw-dc1-01',
            ].includes(s.id)
        ).map((s) => ({
          serverId: s.id,
          metrics: {
            cpu: [normalMetrics[s.type].cpu + 8, normalMetrics[s.type].cpu + 5],
            memory: [
              normalMetrics[s.type].memory + 8,
              normalMetrics[s.type].memory + 5,
            ],
            disk: [
              normalMetrics[s.type].disk + 5,
              normalMetrics[s.type].disk + 3,
            ],
            network: [
              normalMetrics[s.type].network + 10,
              normalMetrics[s.type].network + 6,
            ],
          },
          curveType: 'linear' as const,
        })),
      ],
    },
  ],
};
