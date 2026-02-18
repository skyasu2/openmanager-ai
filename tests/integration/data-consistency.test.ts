/**
 * Dashboard ↔ AI Data Consistency Test
 *
 * 동일 OTel hourly 데이터를 Vercel(extractMetricsFromOTelHourly)과
 * Cloud Run(동일 매핑 로직) 양쪽에서 처리했을 때 결과가 일치하는지 검증.
 *
 * @vitest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// Mock dependencies for extractMetricsFromOTelHourly
vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/data/otel-data', () => ({
  getOTelResourceCatalog: () => null,
}));

vi.mock('@/config/rules/loader', () => ({
  getServerStatus: ({
    cpu,
    memory,
    disk,
  }: {
    cpu: number;
    memory: number;
    disk: number;
  }) => {
    if (cpu > 90 || memory > 90 || disk > 95) return 'critical';
    if (cpu > 70 || memory > 70 || disk > 80) return 'warning';
    return 'online';
  },
}));

import { normalizeUtilizationPercent } from '@/services/metrics/metric-normalization';
import { extractMetricsFromOTelHourly } from '@/services/metrics/metric-transformers';

describe('Dashboard ↔ AI Data Consistency', () => {
  const hourlyFilePath = path.resolve(
    process.cwd(),
    'public/data/otel-data/hourly/hour-14.json'
  );

  it('extractMetricsFromOTelHourly produces consistent results for minuteOfDay=870', async () => {
    // Given: hour-14.json 로드
    const raw = fs.readFileSync(hourlyFilePath, 'utf-8');
    const hourlyData = JSON.parse(raw);

    // When: minuteOfDay=870 (14:30) 기준 메트릭 추출
    const result = await extractMetricsFromOTelHourly(
      hourlyData,
      '2026-02-18T14:30:00+09:00',
      870
    );

    // Then: 결과에 서버가 존재하고 유효한 메트릭 값 포함
    expect(result.length).toBeGreaterThan(0);

    for (const server of result) {
      expect(server.serverId).toBeTruthy();
      expect(server.cpu).toBeGreaterThanOrEqual(0);
      expect(server.cpu).toBeLessThanOrEqual(100);
      expect(server.memory).toBeGreaterThanOrEqual(0);
      expect(server.memory).toBeLessThanOrEqual(100);
      expect(server.disk).toBeGreaterThanOrEqual(0);
      expect(server.disk).toBeLessThanOrEqual(100);
    }
  });

  it('same slot produces identical results on repeated calls (idempotency)', async () => {
    // Given: 동일 데이터
    const raw = fs.readFileSync(hourlyFilePath, 'utf-8');
    const hourlyData = JSON.parse(raw);

    // When: 동일 파라미터로 두 번 호출
    const result1 = await extractMetricsFromOTelHourly(
      hourlyData,
      '2026-02-18T14:30:00+09:00',
      870
    );
    const result2 = await extractMetricsFromOTelHourly(
      hourlyData,
      '2026-02-18T14:30:00+09:00',
      870
    );

    // Then: 서버 수 동일, 서버별 CPU/Memory/Disk 0.1% 이내 차이
    expect(result1.length).toBe(result2.length);

    const sorted1 = [...result1].sort((a, b) =>
      a.serverId.localeCompare(b.serverId)
    );
    const sorted2 = [...result2].sort((a, b) =>
      a.serverId.localeCompare(b.serverId)
    );

    for (let i = 0; i < sorted1.length; i++) {
      expect(sorted1[i].serverId).toBe(sorted2[i].serverId);
      expect(Math.abs(sorted1[i].cpu - sorted2[i].cpu)).toBeLessThanOrEqual(
        0.1
      );
      expect(
        Math.abs(sorted1[i].memory - sorted2[i].memory)
      ).toBeLessThanOrEqual(0.1);
      expect(Math.abs(sorted1[i].disk - sorted2[i].disk)).toBeLessThanOrEqual(
        0.1
      );
    }
  });

  it('Cloud Run metric mapping matches Vercel mapping for shared metric names', async () => {
    // Given: hour-14.json의 원본 슬롯 데이터
    const raw = fs.readFileSync(hourlyFilePath, 'utf-8');
    const hourlyData = JSON.parse(raw);

    // minuteOfDay=870 → minuteInHour=30 → slotIndex 계산
    const minuteInHour = 870 % 60; // 30
    const slotCount = hourlyData.slots.length;
    const slotIndex =
      slotCount === 60
        ? minuteInHour
        : Math.min(slotCount - 1, Math.floor((minuteInHour / 60) * slotCount));
    const slot = hourlyData.slots[slotIndex];
    expect(slot).toBeDefined();

    // When: Cloud Run과 동일한 매핑 로직으로 수동 변환
    const cloudRunMap: Record<
      string,
      { cpu: number; memory: number; disk: number }
    > = {};

    for (const metric of slot.metrics) {
      for (const dp of metric.dataPoints) {
        const hostname = dp.attributes['host.name'];
        const serverId = hostname?.replace('.openmanager.kr', '') ?? '';
        if (!serverId) continue;

        if (!cloudRunMap[serverId]) {
          cloudRunMap[serverId] = { cpu: 0, memory: 0, disk: 0 };
        }

        switch (metric.name) {
          case 'system.cpu.utilization':
            cloudRunMap[serverId].cpu = normalizeUtilizationPercent(
              dp.asDouble
            );
            break;
          case 'system.memory.utilization':
            cloudRunMap[serverId].memory = normalizeUtilizationPercent(
              dp.asDouble
            );
            break;
          case 'system.filesystem.utilization':
            cloudRunMap[serverId].disk = normalizeUtilizationPercent(
              dp.asDouble
            );
            break;
        }
      }
    }

    // Then: Vercel 경로와 비교
    const vercelResult = await extractMetricsFromOTelHourly(
      hourlyData,
      '2026-02-18T14:30:00+09:00',
      870
    );

    const vercelMap = new Map(vercelResult.map((s) => [s.serverId, s]));

    // 두 경로에서 추출된 서버 목록이 동일
    const cloudRunServerIds = Object.keys(cloudRunMap).sort();
    const vercelServerIds = [...vercelMap.keys()].sort();
    expect(cloudRunServerIds).toEqual(vercelServerIds);

    // 서버별 CPU/Memory/Disk 값 비교 (0.1% 오차 허용)
    for (const serverId of cloudRunServerIds) {
      const cr = cloudRunMap[serverId];
      const vc = vercelMap.get(serverId)!;

      expect(Math.abs(cr.cpu - vc.cpu)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(cr.memory - vc.memory)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(cr.disk - vc.disk)).toBeLessThanOrEqual(0.1);
    }
  });
});
