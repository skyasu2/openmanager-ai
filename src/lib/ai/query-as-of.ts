import { getKSTDateTime } from '@/services/metrics/kst-time';
import type { JobDataSlot, JobQueryAsOf } from '@/types/ai-jobs';

export const JOB_DATASET_VERSION = '24h-rotating-v1.0.0' as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeInteger(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function normalizeTimeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}(?:\s+KST)?$/.test(trimmed)) return undefined;
  return trimmed.endsWith('KST') ? trimmed : `${trimmed} KST`;
}

export function normalizeJobDataSlot(value: unknown): JobDataSlot | undefined {
  if (!isRecord(value)) return undefined;

  const slotIndex = normalizeInteger(value.slotIndex, 0, 143);
  const minuteOfDay = normalizeInteger(value.minuteOfDay, 0, 1430);
  const timeLabel = normalizeTimeLabel(value.timeLabel);

  if (
    slotIndex === undefined ||
    minuteOfDay === undefined ||
    timeLabel === undefined ||
    minuteOfDay !== slotIndex * 10
  ) {
    return undefined;
  }

  return {
    slotIndex,
    minuteOfDay,
    timeLabel,
  };
}

export function buildCurrentJobDataSlot(): JobDataSlot {
  const kst = getKSTDateTime();
  return {
    slotIndex: kst.slotIndex,
    minuteOfDay: kst.minuteOfDay,
    timeLabel: `${kst.time} KST`,
  };
}

export function buildJobQueryAsOf(
  createdAt: string,
  preferredDataSlot?: unknown
): JobQueryAsOf {
  const dataSlot =
    normalizeJobDataSlot(preferredDataSlot) ?? buildCurrentJobDataSlot();

  return {
    createdAt,
    source: 'vercel-static-otel',
    datasetVersion: JOB_DATASET_VERSION,
    dataSlot,
  };
}

export function createQueryAsOf(
  dataSlot?: JobDataSlot
): JobQueryAsOf | undefined {
  if (!dataSlot) return undefined;
  return {
    createdAt: new Date().toISOString(),
    source: 'vercel-static-otel',
    datasetVersion: JOB_DATASET_VERSION,
    dataSlot,
  };
}
