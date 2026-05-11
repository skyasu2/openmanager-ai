import { getCurrentState, getKSTDateTime, getSlots } from '../../data/precomputed-state';
import type {
  PrecomputedSlot,
  ServerSnapshot,
} from '../../data/precomputed-state.types';

const DEFAULT_PEAK_WINDOW_HOURS = 24;

export type PeakMetric = 'load' | 'cpu' | 'memory' | 'disk' | 'network';
type ServerMetricKey =
  | 'load1'
  | 'load5'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network';

interface MetricCandidate {
  key: ServerMetricKey;
  label: string;
  unit: string;
}

interface MetricDefinition {
  metric: PeakMetric;
  label: string;
  candidates: MetricCandidate[];
  fallbackMetric?: PeakMetric;
}

export interface PeakMetricServer {
  id: string;
  name: string;
  status: ServerSnapshot['status'];
  value: number;
  cpuCores?: number;
}

export interface PeakMetricSlot {
  slotIndex: number;
  timeLabel: string;
  dateLabel: string;
  fullTimestamp: string;
  windowHours: number;
  requestedMetric: PeakMetric;
  resolvedMetric: PeakMetric;
  sourceKey: ServerMetricKey;
  sourceLabel: string;
  unit: string;
  usedFallbackMetric: boolean;
  value: number;
  averageTopValue: number;
  topServers: PeakMetricServer[];
}

const METRIC_DEFINITIONS: Record<PeakMetric, MetricDefinition> = {
  load: {
    metric: 'load',
    label: '부하',
    candidates: [
      { key: 'load1', label: '1분 평균 로드(load1)', unit: '' },
      { key: 'load5', label: '5분 평균 로드(load5)', unit: '' },
    ],
    fallbackMetric: 'cpu',
  },
  cpu: {
    metric: 'cpu',
    label: 'CPU',
    candidates: [{ key: 'cpu', label: 'CPU 사용률', unit: '%' }],
  },
  memory: {
    metric: 'memory',
    label: '메모리',
    candidates: [{ key: 'memory', label: '메모리 사용률', unit: '%' }],
  },
  disk: {
    metric: 'disk',
    label: '디스크',
    candidates: [{ key: 'disk', label: '디스크 사용률', unit: '%' }],
  },
  network: {
    metric: 'network',
    label: '네트워크',
    candidates: [{ key: 'network', label: '네트워크 사용률', unit: '%' }],
  },
};

function isFiniteMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readMetric(server: ServerSnapshot, key: ServerMetricKey): number | null {
  const value = server[key];
  return isFiniteMetric(value) ? value : null;
}

function normalizeWindowHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_PEAK_WINDOW_HOURS;
  }
  return Math.min(24, Math.max(1, Math.ceil(hours)));
}

function getPreviousKSTDateLabel(currentDate: string): string {
  const previousDate = new Date(`${currentDate}T00:00:00+09:00`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const date = previousDate.toISOString().slice(0, 10);
  return `${date} (어제)`;
}

function resolveCurrentSlotArrayIndex(slots: PrecomputedSlot[]): number {
  const current = getCurrentState();
  const index = slots.findIndex((slot) => slot.slotIndex === current.slotIndex);
  return index >= 0 ? index : 0;
}

function getRecentSlots(hours: number): Array<{
  slot: PrecomputedSlot;
  dateLabel: string;
  fullTimestamp: string;
}> {
  const slots = getSlots();
  if (slots.length === 0) return [];

  const windowHours = normalizeWindowHours(hours);
  const currentIndex = resolveCurrentSlotArrayIndex(slots);
  const slotsPerHour = slots.length / 24;
  const slotCount = Math.min(slots.length, Math.max(1, Math.ceil(windowHours * slotsPerHour)));
  const currentDate = getKSTDateTime().date;
  const previousDateLabel = getPreviousKSTDateLabel(currentDate);

  return Array.from({ length: slotCount }, (_, offset) => {
    const index = (currentIndex - offset + slots.length) % slots.length;
    const slot = slots[index] ?? slots[0];
    const dateLabel = offset > currentIndex ? previousDateLabel : currentDate;
    const date = dateLabel.split(' ')[0] ?? currentDate;

    return {
      slot,
      dateLabel,
      fullTimestamp: `${date}T${slot.timeLabel}:00+09:00`,
    };
  });
}

function resolveMetricCandidate(
  slots: PrecomputedSlot[],
  metric: PeakMetric
): {
  definition: MetricDefinition;
  candidate: MetricCandidate;
  usedFallbackMetric: boolean;
} | null {
  const definition = METRIC_DEFINITIONS[metric];

  for (const candidate of definition.candidates) {
    const hasMetric = slots.some((slot) =>
      slot.servers.some((server) => readMetric(server, candidate.key) !== null)
    );
    if (hasMetric) {
      return { definition, candidate, usedFallbackMetric: false };
    }
  }

  if (!definition.fallbackMetric) {
    return null;
  }

  const fallback = resolveMetricCandidate(slots, definition.fallbackMetric);
  return fallback ? { ...fallback, usedFallbackMetric: true } : null;
}

export function getPeakMetricSlot({
  metric,
  hours = DEFAULT_PEAK_WINDOW_HOURS,
}: {
  metric: PeakMetric;
  hours?: number;
}): PeakMetricSlot | null {
  const windowHours = normalizeWindowHours(hours);
  const recentSlots = getRecentSlots(windowHours);
  const metricSource = resolveMetricCandidate(
    recentSlots.map(({ slot }) => slot),
    metric
  );

  if (!metricSource) return null;

  const { candidate, definition, usedFallbackMetric } = metricSource;
  let peak: PeakMetricSlot | null = null;

  for (const { slot, dateLabel, fullTimestamp } of recentSlots) {
    const topServers = slot.servers
      .filter((server) => server.status !== 'offline')
      .map((server): PeakMetricServer | null => {
        const value = readMetric(server, candidate.key);
        if (value === null) return null;
        return {
          id: server.id,
          name: server.name,
          status: server.status,
          value,
          ...(isFiniteMetric(server.cpuCores) && { cpuCores: server.cpuCores }),
        };
      })
      .filter((server): server is PeakMetricServer => server !== null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    const topServer = topServers[0];
    if (!topServer) continue;

    const averageTopValue =
      topServers.reduce((sum, server) => sum + server.value, 0) /
      topServers.length;

    if (peak && topServer.value <= peak.value) continue;

    peak = {
      slotIndex: slot.slotIndex,
      timeLabel: slot.timeLabel,
      dateLabel,
      fullTimestamp,
      windowHours,
      requestedMetric: metric,
      resolvedMetric: definition.metric,
      sourceKey: candidate.key,
      sourceLabel: candidate.label,
      unit: candidate.unit,
      usedFallbackMetric,
      value: topServer.value,
      averageTopValue,
      topServers,
    };
  }

  return peak;
}

export function getMonitoringPeakMetric(input: {
  metric: string;
  windowHours: number;
}): PeakMetricSlot | null {
  if (!(input.metric in METRIC_DEFINITIONS)) {
    return null;
  }

  return getPeakMetricSlot({
    metric: input.metric as PeakMetric,
    hours: input.windowHours,
  });
}
