import { AsyncLocalStorage } from 'node:async_hooks';

export interface QueryDataSlot {
  slotIndex: number;
  minuteOfDay: number;
  timeLabel: string;
}

export interface QueryAsOf {
  createdAt: string;
  source: 'vercel-static-otel';
  datasetVersion: '24h-rotating-v1.0.0';
  dataSlot: QueryDataSlot;
}

const storage = new AsyncLocalStorage<QueryAsOf>();

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

export function normalizeQueryAsOf(value: unknown): QueryAsOf | undefined {
  if (!isRecord(value) || !isRecord(value.dataSlot)) return undefined;

  const createdAt =
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : undefined;
  const source =
    value.source === 'vercel-static-otel' ? value.source : undefined;
  const datasetVersion =
    value.datasetVersion === '24h-rotating-v1.0.0'
      ? value.datasetVersion
      : undefined;
  const slotIndex = normalizeInteger(value.dataSlot.slotIndex, 0, 143);
  const minuteOfDay = normalizeInteger(value.dataSlot.minuteOfDay, 0, 1430);
  const timeLabel = normalizeTimeLabel(value.dataSlot.timeLabel);

  if (
    !createdAt ||
    !source ||
    !datasetVersion ||
    slotIndex === undefined ||
    minuteOfDay === undefined ||
    timeLabel === undefined ||
    minuteOfDay !== slotIndex * 10
  ) {
    return undefined;
  }

  return {
    createdAt,
    source,
    datasetVersion,
    dataSlot: {
      slotIndex,
      minuteOfDay,
      timeLabel,
    },
  };
}

export function runWithQueryAsOf<T>(
  queryAsOf: QueryAsOf | undefined,
  callback: () => T
): T {
  if (!queryAsOf) return callback();
  return storage.run(queryAsOf, callback);
}

export function getActiveQueryAsOf(): QueryAsOf | undefined {
  return storage.getStore();
}

export function getActiveQuerySlotIndex(): number | undefined {
  return getActiveQueryAsOf()?.dataSlot.slotIndex;
}
