import type { Server } from '@/types/server';

const STATUS_PRIORITY = {
  critical: 0,
  offline: 0,
  warning: 1,
  online: 2,
} as const;

export type ServerSortKey = 'status' | 'cpu' | 'memory' | 'name';

export const DEFAULT_VISIBLE_ROWS = 3;

const SERVER_CARD_FIXED_WIDTH = 320;
const SERVER_CARD_GAP = 24;

export const SORT_OPTIONS: Array<{ value: ServerSortKey; label: string }> = [
  { value: 'status', label: '상태' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'MEM' },
  { value: 'name', label: '이름' },
];

function getAlertsCountOptimized(alerts: unknown): number {
  if (typeof alerts === 'number') return alerts;
  if (Array.isArray(alerts)) return alerts.length;
  return 0;
}

export function compareByStatusPriority(a: Server, b: Server): number {
  const statusA = a?.status || 'unknown';
  const statusB = b?.status || 'unknown';

  const priorityA =
    STATUS_PRIORITY[statusA as keyof typeof STATUS_PRIORITY] ?? 3;
  const priorityB =
    STATUS_PRIORITY[statusB as keyof typeof STATUS_PRIORITY] ?? 3;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const alertsA = getAlertsCountOptimized(a?.alerts);
  const alertsB = getAlertsCountOptimized(b?.alerts);

  if (alertsA !== alertsB) {
    return alertsB - alertsA;
  }

  return a.name.localeCompare(b.name, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function normalizeServerSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR');
}

export function matchesServerSearch(
  server: Server,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return true;

  return [server.name, server.id, server.hostname, server.location, server.ip]
    .map(normalizeServerSearchValue)
    .some((value) => value.includes(normalizedQuery));
}

export function getServerCardColumns(width: number): number {
  if (width < 640) return 1;

  const columns = Math.floor(
    (width + SERVER_CARD_GAP) / (SERVER_CARD_FIXED_WIDTH + SERVER_CARD_GAP)
  );

  return Math.max(1, Math.min(4, columns));
}
